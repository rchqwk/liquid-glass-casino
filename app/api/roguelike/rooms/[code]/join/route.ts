import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { joinRoom, updateRoom, RoomError, roomView } from "../../../../../lib/roguelikeRoom";

import { issueSeat, ownsSeat } from "../../../../../lib/roguelikeAuthority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || ""))return NextResponse.json({error:"JSON request required"},{status:415});
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { playerId?: string; username?: string } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);
  const username = String(body?.username ?? "Player").slice(0, 24);
  if (!playerId) return NextResponse.json({ error: "playerId required." }, { status: 400 });

  const authed = await getAuthedUserAsync().catch(() => null);
  try {
    const next = await updateRoom(code, async room => {
      if (!room) throw new RoomError("Room not found.", 404);
      const existing = room.players.some(p => p.playerId === playerId);
      if (existing && !await ownsSeat(room, playerId)) throw new RoomError("Seat ownership required.", 403);
      const result = joinRoom(room, playerId, authed?.username ?? username, authed?.id ?? null);
      if (result.error) throw new RoomError(result.error);
      if (!existing) await issueSeat(result.room, playerId);
      if (room.discordChannelId) room.players.find(p => p.playerId === playerId)!.lastSeenAt = Date.now();
      return result.room;
    });
    return NextResponse.json({ room: roomView(next, playerId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not join room." }, { status: error instanceof RoomError ? error.status : 500 });
  }
}
