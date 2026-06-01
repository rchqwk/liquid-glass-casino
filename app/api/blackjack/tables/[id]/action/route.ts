import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { applyPlayerAction, applySpecial, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { type?: "hit" | "stand" | "special"; specialId?: string; targetUserId?: number | null }
    | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const now = Date.now();
  const base = tickTable(t.state, now);

  let res:
    | { state: any; error?: string }
    | { state: any; error?: string } = { state: base };

  if (body?.type === "hit" || body?.type === "stand") {
    res = applyPlayerAction(base, user.id, { type: body.type }, now);
  } else if (body?.type === "special") {
    res = applySpecial(base, user.id, { id: body.specialId as any, targetUserId: body.targetUserId ?? null }, now);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state: res.state, created_at: t.created_at, updated_at: res.state.updatedAt });
  for (const p of res.state.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
  for (const ev of res.state.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
  res.state.evictedInventories = [];

  if (res.error) return NextResponse.json({ error: res.error, state: safePublicStateForUser(res.state, user.id) }, { status: 400 });
  return NextResponse.json({ state: safePublicStateForUser(res.state, user.id) });
}
