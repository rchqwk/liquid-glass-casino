import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);
  state.lastActivityAt = now;

  // remove from spectators
  state.spectators = state.spectators.filter((u) => u !== user.id);
  // remove from seats (save inventory)
  for (let i = 0; i < state.seats.length; i++) {
    const p = state.seats[i];
    if (p?.userId === user.id) {
      await upsertBlackjackInventory(user.id, p.inventory);
      state.seats[i] = null;
    }
  }

  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state, created_at: t.created_at, updated_at: state.updatedAt });
  return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
}
