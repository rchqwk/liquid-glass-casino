import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory, getBlackjackTable, upsertBlackjackInventory } from "../../../lib/db";
import { ensureInventory, tickTable, unopenedBoxCount, SPECIALS, type InventoryCategoryId } from "../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState, syncUserBlackjackInventoryIntoTables } from "../../../lib/blackjackStatePersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const tableId = url.searchParams.get("tableId");

  // Keep inventory "clockwork" accurate by ticking the active table (if provided) before
  // reading inventory for the mystery box tab.
  if (tableId) {
    const t = await getBlackjackTable(String(tableId).slice(0, 48));
    if (t) {
      const now = Date.now();
      const next = tickTable(t.state, now);
      if (next.updatedAt !== t.updated_at) {
        await saveBlackjackTableState(t, next);
      }
    }
  }

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
    bonusPoints: Math.max(0, Math.floor(Number((inv as any).bonusPoints ?? 0) || 0)),
    boxes,
  });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { boxId?: string; all?: boolean; tableId?: string } | null;
  const boxId = body?.boxId ? String(body.boxId) : null;
  const openAll = body?.all === true;
  const tableId = body?.tableId ? String(body.tableId) : null;

  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? null);
  const boxes = inv.boxes ?? [];
  const openedRewards: Array<{ id: string; rarity: string }> = [];
  let openedBoxesCount = 0;
  let openedBox:
    | { id: string; tier?: string; awardedAt: number; opened: boolean; openedAt?: number; contents?: string[] }
    | null = null;

  const applyContents = (contents: string[]) => {
    for (const id of contents) {
      const s = SPECIALS[id as keyof typeof SPECIALS];
      if (!s) continue;
      const isMagic = id.startsWith("MAGIC_") || id.includes("_MAGIC");
      const isSave = id.startsWith("SUB");
      const isDealer = id.includes("DEALER") && !id.includes("MAGIC") && !id.includes("TARGET");
      const isUtility =
        id === "PEEK_NEXT" ||
        id === "SWAP_ONE" ||
        id === "FORCE_HIT_TARGET" ||
        id === "BJ_PROTECTOR" ||
        id === "FREE_SPLIT" ||
        id.startsWith("REMOVE_");
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
      openedRewards.push({ id, rarity: String((SPECIALS as any)[id]?.rarity ?? "common") });
    }
  };

  if (openAll) {
    const now = Date.now();
    const unopened = boxes.filter((b) => !b.opened);
    if (unopened.length === 0) return NextResponse.json({ error: "No unopened boxes" }, { status: 400 });
    for (const box of unopened) {
      const contents = (box.contents ?? []).filter((id) => id in SPECIALS);
      applyContents(contents);
      box.opened = true;
      box.openedAt = now;
      openedBoxesCount += 1;
    }
  } else {
    const idx = boxId ? boxes.findIndex((b) => b.id === boxId) : boxes.findIndex((b) => !b.opened);
    if (idx < 0) return NextResponse.json({ error: "No unopened boxes" }, { status: 400 });

    const box = boxes[idx]!;
    if (box.opened) return NextResponse.json({ error: "Box already opened" }, { status: 400 });

    const contents = (box.contents ?? []).filter((id) => id in SPECIALS);
    applyContents(contents);
    box.opened = true;
    box.openedAt = Date.now();
    openedBox = box as any;
    openedBoxesCount = 1;
  }

  await upsertBlackjackInventory(user.id, inv);

  // IMPORTANT: keep active table state inventories in sync.
  // Otherwise, the next table poll tick can overwrite the DB inventory with the stale table copy.
  await syncUserBlackjackInventoryIntoTables(user.id, inv, tableId);

  if (!openAll) {
    const box = openedBox;
    const contents = box?.opened ? ((box.contents ?? []).filter((id) => id in SPECIALS) as string[]) : [];
    const rarity = contents.map((id) => (SPECIALS as any)[id]?.rarity ?? "common");
    return NextResponse.json({
      ok: true,
      unopened: unopenedBoxCount(inv),
      box: {
        id: box?.id ?? "unknown",
        tier: box?.tier ?? "normal",
        awardedAt: box?.awardedAt ?? 0,
        openedAt: box?.openedAt ?? Date.now(),
        contents,
        rarity,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    unopened: unopenedBoxCount(inv),
    openedCount: openedBoxesCount,
    rewards: openedRewards,
  });
}
