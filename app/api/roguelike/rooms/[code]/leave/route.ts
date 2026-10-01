import { NextResponse } from "next/server";
import { leaveRoom, persistRoomXp, updateRoom, RoomError } from "../../../../../lib/roguelikeRoom";

import { ownsSeat } from "../../../../../lib/roguelikeAuthority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || ""))return NextResponse.json({error:"JSON request required"},{status:415});
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { playerId?: string } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);

  try {
    let awardXp = false;
    const next = await updateRoom(code, async room => {
      awardXp = false;
      if (!room) throw new RoomError("Room not found.", 404);
      if (!await ownsSeat(room, playerId)) throw new RoomError("Seat ownership required.", 403);
      const wasEnded = room.runEnded;
      leaveRoom(room, playerId);
      awardXp = !wasEnded && room.runEnded && !!room.xp;
      return room;
    });
    if (awardXp) await persistRoomXp(next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not leave room." }, { status: error instanceof RoomError ? error.status : 500 });
  }
}
