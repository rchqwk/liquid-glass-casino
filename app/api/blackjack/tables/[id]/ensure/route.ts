import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { newTableState, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const tableId = String(id ?? "").slice(0, 48);
  if (!tableId) return NextResponse.json({ error: "Invalid table id" }, { status: 400 });

  const now = Date.now();
  const existing = await getBlackjackTable(tableId);
  if (!existing) {
    const state = newTableState({ id: tableId, name: "Discord Blackjack", public: false, now });
    await upsertBlackjackTable({
      id: tableId,
      public: false,
      name: "Discord Blackjack",
      state,
      created_at: now,
      updated_at: state.updatedAt,
    });
    return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
  }

  const next = tickTable(existing.state, now);
  if (next.updatedAt !== existing.updated_at) {
    await upsertBlackjackTable({
      id: existing.id,
      public: existing.public,
      name: existing.name,
      state: next,
      created_at: existing.created_at,
      updated_at: next.updatedAt,
    });
    for (const p of next.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
    for (const ev of next.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
    next.evictedInventories = [];
  }
  return NextResponse.json({ state: safePublicStateForUser(next, user.id) });
}

