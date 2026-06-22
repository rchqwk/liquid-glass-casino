import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import {
  getBlackjackInventory,
  upsertBlackjackInventory,
} from "../../../../lib/db";
import { SPECIALS } from "../../../../lib/blackjackMultiplayer";
import { ensureInventory } from "../../../../lib/blackjackInventory";
import { syncUserBlackjackInventoryIntoTables } from "../../../../lib/blackjackStatePersistence";
import { shortId } from "../../../../lib/blackjackUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const body = (await req.json().catch(() => null)) as { toTier?: "rare" | "legendary" | "mythic"; tableId?: string } | null;
  const toTier = body?.toTier === "mythic" ? "mythic" : body?.toTier === "legendary" ? "legendary" : "rare";
  const fromTier = toTier === "rare" ? "normal" : toTier === "legendary" ? "rare" : "legendary";
  const tableId = body?.tableId ? String(body.tableId) : null;

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

  await syncUserBlackjackInventoryIntoTables(user.id, inv, tableId);

  return NextResponse.json({ ok: true });
}
