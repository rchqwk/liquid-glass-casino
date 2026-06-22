import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable } from "../../../../../lib/db";
import { applyPerfectPairsBet, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { amount?: number; betNonce?: number | null } | null;
  const amount = Number(body?.amount ?? 0);
  const betNonce = body?.betNonce ?? null;
  if (!(amount > 0)) return NextResponse.json({ error: "Bet amount must be > 0." }, { status: 400 });

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const base = tickTable(t.state, now);
  const res = applyPerfectPairsBet(base, user.id, amount, now, betNonce);

  await saveBlackjackTableState(t, res.state);

  if (res.error) return NextResponse.json({ error: res.error, state: safePublicStateForUser(res.state, user.id) }, { status: 400 });
  return NextResponse.json({ state: safePublicStateForUser(res.state, user.id) });
}
