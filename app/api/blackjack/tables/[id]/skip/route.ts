import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackTable } from "../../../../../lib/db";
import { applySkip, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { persistBlackjackStateInventories } from "../../../../../lib/blackjackStatePersistence";

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

  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state: res.state, created_at: t.created_at, updated_at: res.state.updatedAt });
  await persistBlackjackStateInventories(res.state);

  if (res.error) return NextResponse.json({ error: res.error, state: safePublicStateForUser(res.state, user.id) }, { status: 400 });
  return NextResponse.json({ state: safePublicStateForUser(res.state, user.id) });
}
