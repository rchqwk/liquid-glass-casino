import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory, upsertBlackjackInventory } from "../../../lib/db";
import { ensureInventory, unopenedBoxCount, SPECIALS, type InventoryCategoryId } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);

  const boxes = (inv.boxes ?? []).map((b) => ({
    id: b.id,
    awardedAt: b.awardedAt,
    openedAt: b.openedAt,
    opened: !!b.opened,
    // Keep contents hidden until opened
    contents: b.opened ? (b.contents ?? []) : undefined,
  }));

  return NextResponse.json({
    unopened: unopenedBoxCount(inv),
    handsPlayed: inv.handsPlayed ?? 0,
    boxes,
  });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { boxId?: string } | null;
  const boxId = body?.boxId ? String(body.boxId) : null;

  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);
  const boxes = inv.boxes ?? [];
  const idx = boxId ? boxes.findIndex((b) => b.id === boxId) : boxes.findIndex((b) => !b.opened);
  if (idx < 0) return NextResponse.json({ error: "No unopened boxes" }, { status: 400 });

  const box = boxes[idx]!;
  if (box.opened) return NextResponse.json({ error: "Box already opened" }, { status: 400 });

  const contents = (box.contents ?? []).filter((id) => id in SPECIALS);
  // Since invAdd is not exported, we apply by incrementing the right category keys here.
  for (const id of contents) {
    const s = SPECIALS[id as keyof typeof SPECIALS];
    if (!s) continue;
    const isMagic = id.startsWith("MAGIC_") || id.includes("_MAGIC");
    const isSave = id.startsWith("SUB");
    const isDealer = id.includes("DEALER") && !id.includes("MAGIC") && !id.includes("TARGET");
    const isUtility = id === "PEEK_NEXT" || id === "SWAP_ONE" || id === "FORCE_HIT_TARGET";
    const catId: InventoryCategoryId = isMagic
      ? "magic"
      : isSave
        ? "saves"
        : isDealer
          ? "dealer"
          : isUtility
            ? "utility"
            : "boosts";
    const bucket = inv.categories[catId] as Record<string, number>;
    bucket[id] = (bucket[id] ?? 0) + 1;
  }

  box.opened = true;
  box.openedAt = Date.now();

  await upsertBlackjackInventory(user.id, inv);

  const rarity = contents.map((id) => (SPECIALS as any)[id]?.rarity ?? "common");
  return NextResponse.json({
    ok: true,
    unopened: unopenedBoxCount(inv),
    box: { id: box.id, awardedAt: box.awardedAt, openedAt: box.openedAt, contents, rarity },
  });
}
