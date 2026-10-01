import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackTable } from "../../../../../lib/db";
import { newTableState, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState, retryBlackjack } from "../../../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../../../lib/blackjackTableContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function POSTImpl(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const tableId = String(id ?? "").slice(0, 48);
  if (!tableId) return NextResponse.json({ error: "Invalid table id" }, { status: 400 });

  const now = Date.now();
  const existing = await getBlackjackTable(tableId);
  if (!existing) {
    const state = newTableState({ id: tableId, name: "Discord Blackjack", public: false, now });
    await saveBlackjackTableState({id:tableId,public:false,name:"Discord Blackjack",created_at:now},state);
    return blackjackTableJsonResponse(state, user.id);
  }

  const next = tickTable(existing.state, now);
  if (next.updatedAt !== existing.updated_at) {
    await saveBlackjackTableState(existing,next);
  }
  return blackjackTableJsonResponse(next, user.id);
}

export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return retryBlackjack(()=>POSTImpl(req.clone(),ctx));}
