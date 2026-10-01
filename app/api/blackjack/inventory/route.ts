import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory } from "../../../lib/db";
import { ensureInventory, unopenedBoxCount } from "../../../lib/blackjackInventory";
import { SPECIALS } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Sign in to view your inventory." }, { status: 401 });
  const inventory = ensureInventory((await getBlackjackInventory(user.id)) ?? null);
  const cards = Object.entries(inventory.categories).flatMap(([category, items]) => Object.entries(items).filter(([, count]) => Number(count) > 0).map(([id, count]) => ({ id, category, count, name: SPECIALS[id as keyof typeof SPECIALS]?.name ?? id.replaceAll("_", " ") })));
  return NextResponse.json({ cards, bonusPoints: inventory.bonusPoints, boxes: unopenedBoxCount(inventory), bonds: inventory.bond?.owned ?? 0, activeBondValue: inventory.bond?.active?.value ?? null, decorations: inventory.collectibles?.owned ?? {}, figurines: inventory.collectibles?.figurines.length ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
