import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../lib/db";
import { safePublicStateForUser, tickTable } from "../../../../lib/blackjackMultiplayer";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const next = tickTable(t.state, now);
  if (next.updatedAt !== t.updated_at) {
    await upsertBlackjackTable({
      id: t.id,
      public: t.public,
      name: t.name,
      state: next,
      created_at: t.created_at,
      updated_at: next.updatedAt,
    });
    for (const p of next.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
    for (const ev of next.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
    next.evictedInventories = [];
  }

  return NextResponse.json({ state: safePublicStateForUser(next, user.id) });
}
