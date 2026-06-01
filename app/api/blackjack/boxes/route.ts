import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory, getBlackjackTable, listBlackjackTables, upsertBlackjackInventory, upsertBlackjackTable } from "../../../lib/db";
import { ensureInventory, unopenedBoxCount, SPECIALS, type InventoryCategoryId } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);

  const boxes = (inv.boxes ?? []).map((b) => ({
    id: b.id,
    tier: b.tier ?? "normal",
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
    const isUtility = id === "PEEK_NEXT" || id === "SWAP_ONE" || id === "FORCE_HIT_TARGET" || id === "BJ_PROTECTOR" || id === "FREE_SPLIT";
    const isMythic = (SPECIALS as any)[id]?.rarity === "mythic";
    const catId: InventoryCategoryId = isMagic
      ? "magic"
      : isSave
        ? "saves"
        : isDealer
          ? "dealer"
          : isMythic
            ? ("mythic" as InventoryCategoryId)
            : isUtility
              ? "utility"
              : "boosts";
    const bucket = inv.categories[catId] as Record<string, number>;
    bucket[id] = (bucket[id] ?? 0) + 1;
  }

  box.opened = true;
  box.openedAt = Date.now();

  await upsertBlackjackInventory(user.id, inv);

  // IMPORTANT: keep active table state inventories in sync.
  // Otherwise, the next table poll tick can overwrite the DB inventory with the stale table copy.
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

  const rarity = contents.map((id) => (SPECIALS as any)[id]?.rarity ?? "common");
  return NextResponse.json({
    ok: true,
    unopened: unopenedBoxCount(inv),
    box: { id: box.id, tier: box.tier ?? "normal", awardedAt: box.awardedAt, openedAt: box.openedAt, contents, rarity },
  });
}
