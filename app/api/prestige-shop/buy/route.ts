import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackInventory, spendPrestigePoints, upsertBlackjackInventory } from "../../../lib/db";
import { defaultInventory, ensureInventory } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { item?: string; currency?: "pp" | "bp" } | null;
  const item = String(body?.item ?? "");
  const currency = (body?.currency ?? "pp") as "pp" | "bp";
  if (item !== "bond") return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // Load blackjack inventory (needed for both PP and BP purchase paths).
  const rawInv = (await getBlackjackInventory(user.id)) ?? defaultInventory();
  const inv = ensureInventory(rawInv);

  // Pay either with prestige points (PP) or bonus points (BP).
  let updatedUser: any = user;
  if (currency === "pp") {
    // Spend 1 prestige point.
    try {
      updatedUser = await spendPrestigePoints({ userId: user.id, cost: 1 });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? "Not enough prestige points.") }, { status: 400 });
    }
    if (!updatedUser) return NextResponse.json({ error: "Failed" }, { status: 500 });
  } else {
    const costBp = 50;
    (inv as any).bonusPoints = Math.max(0, Math.floor(Number((inv as any).bonusPoints ?? 0) || 0));
    if ((inv as any).bonusPoints < costBp) {
      return NextResponse.json({ error: `Not enough bonus points. Bond costs ${costBp} BP.` }, { status: 400 });
    }
    (inv as any).bonusPoints -= costBp;
  }

  // Add bond item to blackjack inventory.
  inv.bond = inv.bond ?? { owned: 0, active: null };
  inv.bond.owned = Math.max(0, Math.floor(Number(inv.bond.owned ?? 0) + 1));
  await upsertBlackjackInventory(user.id, inv);

  return NextResponse.json({ ok: true, currency, user: updatedUser, inventory: inv });
}
