import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackInventory, getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { defaultInventory, ensureInventory, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { type?: "activate"; amount?: number }
    | { type?: "buy" }
    | { type?: "info" }
    | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);
  state.lastActivityAt = now;

  const seatIdx = state.seats.findIndex((p) => p?.userId === user.id);
  if (seatIdx < 0) return NextResponse.json({ error: "You are not seated at this table." }, { status: 403 });
  const seat = state.seats[seatIdx]!;
  seat.inventory = ensureInventory(seat.inventory);
  seat.inventory.bond = seat.inventory.bond ?? { owned: 0, active: null };

  const type = String((body as any)?.type ?? "info");
  if (type === "buy") {
    const cost = 50;
    (seat.inventory as any).bonusPoints = Math.max(0, Math.floor(Number((seat.inventory as any).bonusPoints ?? 0) || 0));
    if ((seat.inventory as any).bonusPoints < cost) {
      return NextResponse.json({ error: `Not enough bonus points. Bond costs ${cost}.` }, { status: 400 });
    }
    (seat.inventory as any).bonusPoints -= cost;
    seat.inventory.bond.owned = Math.max(0, Math.floor(Number(seat.inventory.bond.owned ?? 0) || 0) + 1);
    state.updatedAt = now;
  } else if (type === "activate") {
    const amountRaw = (body as any)?.amount;
    const amount = Math.round(Number(amountRaw ?? 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if ((seat.inventory.bond?.owned ?? 0) <= 0) return NextResponse.json({ error: "No bonds available." }, { status: 400 });
    if (seat.inventory.bond?.active) return NextResponse.json({ error: "Bond already active." }, { status: 400 });

    seat.inventory.bond.owned = Math.max(0, Math.floor(Number(seat.inventory.bond.owned ?? 0) - 1));
    seat.inventory.bond.active = {
      principal: amount,
      value: amount,
      startedAt: now,
      lastAccrualAt: now,
    };
    state.updatedAt = now;
  }

  // Persist table + all inventories.
  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state, created_at: t.created_at, updated_at: state.updatedAt });
  for (const p of state.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
  for (const ev of state.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
  state.evictedInventories = [];

  // Ensure user has an inventory row even if something went wrong.
  const inv = (await getBlackjackInventory(user.id)) ?? defaultInventory();
  await upsertBlackjackInventory(user.id, ensureInventory(inv));

  return NextResponse.json({ ok: true, state: safePublicStateForUser(state, user.id) });
}
