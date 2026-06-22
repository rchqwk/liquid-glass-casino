import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory } from "../../../../../lib/db";
import { removeUserBlackjackDecorations, ensureBlackjackDecorations } from "../../../../../lib/blackjackDecorations";
import { safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { returnPlacedCollectiblesToInventory } from "../../../../../lib/blackjackInventory";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";

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
  ensureBlackjackDecorations(state);

  // remove from spectators
  state.spectators = state.spectators.filter((u) => u !== user.id);
  // remove from seats (save inventory)
  for (let i = 0; i < state.seats.length; i++) {
    const p = state.seats[i];
    if (p?.userId === user.id) {
      // Return any placed collectibles back to inventory so they don't stay "stuck" as placed after leaving.
      const inv = returnPlacedCollectiblesToInventory(p.inventory, state.decorations as any, now);
      await upsertBlackjackInventory(user.id, inv);
      state.seats[i] = null;
    }
  }
  // Remove this user's placed decorations from the table. Their positions are stored
  // in their inventory, and will be restored next time they join any table.
  removeUserBlackjackDecorations(state, user.id);

  await saveBlackjackTableState(t, state);
  return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
}
