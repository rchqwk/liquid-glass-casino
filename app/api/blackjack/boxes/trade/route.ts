import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import { getBlackjackInventory, upsertBlackjackInventory } from "../../../../lib/db";
import { ensureInventory, SPECIALS, type InventoryCategoryId } from "../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rarityPoints(r: string) {
  if (r === "mythic") return 20;
  if (r === "legendary") return 8;
  if (r === "rare") return 3;
  return 1;
}

function shortId() {
  return Math.random().toString(16).slice(2, 10);
}

function rollBox(tier: "rare" | "mythic", seed: number) {
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

function classify(id: string): InventoryCategoryId {
  const r = (SPECIALS as any)[id]?.rarity ?? "common";
  if (r === "mythic") return "mythic" as InventoryCategoryId;
  if (id.startsWith("MAGIC_") || id.includes("_MAGIC")) return "magic";
  if (id.startsWith("SUB")) return "saves";
  if (id.includes("DEALER") && !id.includes("MAGIC") && !id.includes("TARGET")) return "dealer";
  if (id === "PEEK_NEXT" || id === "SWAP_ONE" || id === "FORCE_HIT_TARGET" || id === "BJ_PROTECTOR" || id === "FREE_SPLIT") return "utility";
  return "boosts";
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { tier?: "rare" | "mythic" } | null;
  const tier = body?.tier === "mythic" ? "mythic" : "rare";
  const cost = tier === "mythic" ? 50 : 20; // points

  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);

  // Build a list of spendable charges.
  const spend: Array<{ id: string; cat: InventoryCategoryId; pts: number; count: number }> = [];
  for (const [catId, cat] of Object.entries(inv.categories ?? {})) {
    for (const [id, v] of Object.entries(cat ?? {})) {
      const n = Number(v ?? 0);
      if (!Number.isFinite(n) || n <= 0) continue;
      const rarity = (SPECIALS as any)[id]?.rarity ?? "common";
      spend.push({ id, cat: catId as InventoryCategoryId, pts: rarityPoints(String(rarity)), count: n });
    }
  }

  // Spend lowest-value charges first.
  spend.sort((a, b) => a.pts - b.pts);

  let remaining = cost;
  for (const item of spend) {
    if (remaining <= 0) break;
    const take = Math.min(item.count, Math.ceil(remaining / item.pts));
    if (take <= 0) continue;
    item.count -= take;
    remaining -= take * item.pts;
  }

  if (remaining > 0) {
    return NextResponse.json({ error: `Not enough trade points (need ${cost}).` }, { status: 400 });
  }

  // Apply spending back into inventory categories
  // (recompute from original, subtracting what we took)
  // We'll do a second pass: consume per id based on difference.
  const toConsume = new Map<string, number>();
  for (const item of spend) {
    const original = Number((inv.categories[item.cat] as any)?.[item.id] ?? 0);
    const left = item.count;
    const used = Math.max(0, original - left);
    if (used > 0) toConsume.set(item.id, used);
  }
  for (const [id, used] of toConsume) {
    const cat = classify(id);
    const bucket = inv.categories[cat] as Record<string, number>;
    bucket[id] = Math.max(0, (bucket[id] ?? 0) - used);
    if (bucket[id] === 0) delete bucket[id];
  }

  const seed = Math.floor(Date.now() / 1000) ^ (user.id * 2654435761) ^ (tier === "mythic" ? 1234567 : 7654321);
  const contents = rollBox(tier, seed);
  inv.boxes = inv.boxes ?? [];
  inv.boxes.push({
    id: shortId(),
    tier: tier === "mythic" ? "mythic" : "rare",
    awardedAt: Date.now(),
    opened: false,
    contents: contents as any,
  });

  await upsertBlackjackInventory(user.id, inv);
  return NextResponse.json({ ok: true });
}

