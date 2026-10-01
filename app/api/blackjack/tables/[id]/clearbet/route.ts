import { blackjackRequest } from "../../../../../lib/blackjackOperation";
import { retryBlackjack } from "../../../../../lib/blackjackStatePersistence";
import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable } from "../../../../../lib/db";
import { applyClearBet, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../../../lib/blackjackTableContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function POSTImpl(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const base = tickTable(t.state, now);
  const res = applyClearBet(base, user.id, now);

  await saveBlackjackTableState(t, res.state);

  if (res.error) return blackjackTableJsonResponse(res.state, user.id, { status: 400, error: res.error });
  return blackjackTableJsonResponse(res.state, user.id);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return blackjackRequest(req,(await ctx.params).id,() => POSTImpl(req.clone(), ctx)); }
