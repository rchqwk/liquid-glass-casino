import { NextResponse } from "next/server";
import { leaveRoom, loadRoom, saveRoom } from "../../../../../lib/roguelikeRoom";

import { ownsSeat } from "../../../../../lib/roguelikeAuthority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || ""))return NextResponse.json({error:"JSON request required"},{status:415});
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { playerId?: string } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);

  const room = await loadRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!await ownsSeat(room, playerId)) return NextResponse.json({ error: "Seat ownership required." }, { status: 403 });

  await saveRoom(leaveRoom(room, playerId));
  return NextResponse.json({ ok: true });
}
