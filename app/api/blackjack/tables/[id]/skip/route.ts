import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable } from "../../../../../lib/db";
import { applySkip, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";
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
  const base = tickTable(t.state, now);
  const res = applySkip(base, user.id, now);

  await saveBlackjackTableState(t, res.state);

  if (res.error) return NextResponse.json({ error: res.error, state: safePublicStateForUser(res.state, user.id) }, { status: 400 });
  return NextResponse.json({ state: safePublicStateForUser(res.state, user.id) });
}
