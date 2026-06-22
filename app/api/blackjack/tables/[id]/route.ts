import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackTable } from "../../../../lib/db";
import { tickTable } from "../../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState } from "../../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../../lib/blackjackTableContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const t = await getBlackjackTable(id);
  if (!t) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = Date.now();
  const next = tickTable(t.state, now);

  // Close rooms after 5 minutes of inactivity (no players + no spectators).
  const empty = next.seats.filter(Boolean).length === 0 && (next.spectators?.length ?? 0) === 0;
  const lastAct = Number(next.lastActivityAt ?? t.updated_at ?? t.created_at ?? 0);
  if (empty && lastAct > 0 && now - lastAct > 5 * 60 * 1000) {
    await upsertBlackjackTable({
      id: t.id,
      public: false,
      name: t.name,
      state: next,
      created_at: t.created_at,
      updated_at: next.updatedAt,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (next.updatedAt !== t.updated_at) {
    await saveBlackjackTableState(t, next);
  }

  return blackjackTableJsonResponse(next, user.id);
}
