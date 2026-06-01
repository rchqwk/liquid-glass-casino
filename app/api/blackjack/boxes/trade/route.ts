import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import {
  getBlackjackInventory,
  getBlackjackTable,
  listBlackjackTables,
  upsertBlackjackInventory,
  upsertBlackjackTable,
} from "../../../../lib/db";
import { ensureInventory, SPECIALS } from "../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shortId() {
  return Math.random().toString(16).slice(2, 10);
}

function rollBox(tier: "rare" | "legendary" | "mythic", seed: number) {
  const rand = (() => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s % 1_000_000) / 1_000_000;
    };
  })();

  const pick = (pool: string[]) => pool[Math.floor(rand() * pool.length)] ?? pool[0] ?? "ADD2_SELF";

  if (tier === "mythic") {
    const pool = Object.values(SPECIALS).filter((s) => s.rarity === "mythic").map((s) => s.id);
    return [pick(pool)];
  }

  if (tier === "legendary") {
    const pool = Object.values(SPECIALS).filter((s) => s.rarity === "legendary").map((s) => s.id);
    return [pick(pool)];
  }

  const pool = Object.values(SPECIALS)
    .filter((s) => s.rarity === "rare" || s.rarity === "legendary")
    .map((s) => s.id);
  const a = pick(pool);
  let b = pick(pool);
  if (pool.length > 1) {
    let guard = 0;
    while (b === a && guard++ < 10) b = pick(pool);
  }
  return [a, b];
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { toTier?: "rare" | "legendary" | "mythic" } | null;
  const toTier = body?.toTier === "mythic" ? "mythic" : body?.toTier === "legendary" ? "legendary" : "rare";
  const fromTier = toTier === "rare" ? "normal" : toTier === "legendary" ? "rare" : "legendary";

  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);
  inv.boxes = inv.boxes ?? [];

  const candidates = inv.boxes.filter((b) => !b.opened && (b.tier ?? "normal") === fromTier);
  if (candidates.length < 3) {
    return NextResponse.json({ error: `Need 3 unopened ${fromTier} boxes to trade.` }, { status: 400 });
  }
  const consumeIds = new Set(candidates.slice(0, 3).map((b) => b.id));
  inv.boxes = inv.boxes.filter((b) => !consumeIds.has(b.id));

  const seed =
    Math.floor(Date.now() / 1000) ^
    (user.id * 2654435761) ^
    (toTier === "mythic" ? 1234567 : toTier === "legendary" ? 7654321 : 424242);
  const contents = rollBox(toTier, seed);
  inv.boxes.push({
    id: shortId(),
    tier: toTier,
    awardedAt: Date.now(),
    opened: false,
    contents: contents as any,
  });

  await upsertBlackjackInventory(user.id, inv);

  // Keep active table state inventories in sync (same reason as box open endpoint).
  const now = Date.now();
  const metas = await listBlackjackTables();
  for (const m of metas) {
    const t = await getBlackjackTable(m.id);
    if (!t) continue;
    const st: any = t.state ?? {};
    const seats: any[] = Array.isArray(st.seats) ? st.seats : [];
    let touched = false;
    for (const p of seats) {
      if (p && p.userId === user.id) {
        p.inventory = inv;
        touched = true;
      }
    }
    if (touched) {
      st.updatedAt = now;
      await upsertBlackjackTable({
        id: t.id,
        public: t.public,
        name: t.name,
        state: st,
        created_at: t.created_at,
        updated_at: now,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
