import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory, spendPrestigePoints, upsertBlackjackInventory } from "../../../lib/db";
import { defaultInventory, ensureInventory } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { item?: string } | null;
  const item = String(body?.item ?? "");
  if (item !== "bond") return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // Spend 1 prestige point.
  let updatedUser: any = null;
  try {
    updatedUser = await spendPrestigePoints({ userId: user.id, cost: 1 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? "Not enough prestige points.") }, { status: 400 });
  }
  if (!updatedUser) return NextResponse.json({ error: "Failed" }, { status: 500 });

  // Add bond item to blackjack inventory.
  const rawInv = (await getBlackjackInventory(user.id)) ?? defaultInventory();
  const inv = ensureInventory(rawInv);
  inv.bond = inv.bond ?? { owned: 0, active: null };
  inv.bond.owned = Math.max(0, Math.floor(Number(inv.bond.owned ?? 0) + 1));
  await upsertBlackjackInventory(user.id, inv);

  return NextResponse.json({ ok: true, user: updatedUser, inventory: inv });
}
