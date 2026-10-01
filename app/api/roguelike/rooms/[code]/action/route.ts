import { NextResponse } from "next/server";
import {
  applyAction,
  dealRoom,
  updateRoom,
  RoomError,
  nextRound,
  persistRoomXp,
  resetRoom,
  roomView,
  type RoomAction,
  type SupportId,
} from "../../../../../lib/roguelikeRoom";

import { ownsSeat } from "../../../../../lib/roguelikeAuthority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: RoomAction[] = ["hit", "stand", "double", "split", "gift"];

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || ""))return NextResponse.json({error:"JSON request required"},{status:415});
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    playerId?: string;
    action?: string;
    targetId?: string;
    supportId?: string;
  } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);
  const action = String(body?.action ?? "");
  if (!playerId) return NextResponse.json({ error: "playerId required." }, { status: 400 });

  let awardXp = false;
  try {
    const next = await updateRoom(code, async room => {
      awardXp = false;
      if (!room) throw new RoomError("Room not found.", 404);
      if (!await ownsSeat(room, playerId)) throw new RoomError("Seat ownership required.", 403);
      if (action === "deal" || action === "next" || action === "reset") {
        if (room.hostId !== playerId) throw new RoomError("Only the host can advance or reset the run.", 403);
        if (action === "reset") return resetRoom(room);
        if (action === "deal" && (room.phase === "lobby" || room.phase === "reveal") && !room.runEnded) return dealRoom(room);
        if (action === "next" && room.phase === "reveal" && !room.runEnded) return nextRound(room);
        throw new RoomError("Cannot advance the round yet.");
      }
      if (!ACTIONS.includes(action as RoomAction)) throw new RoomError("Unknown action.", 400);
      const wasEnded = room.runEnded;
      const result = applyAction(room, playerId, action as RoomAction, {
        targetId: body?.targetId ? String(body.targetId).slice(0, 64) : undefined,
        supportId: body?.supportId ? String(body.supportId) as SupportId : undefined,
      });
      if (result.error) throw new RoomError(result.error);
      awardXp = !wasEnded && result.room.runEnded && !!result.room.xp;
      return result.room;
    });
    if (awardXp) await persistRoomXp(next);
    return NextResponse.json({ room: roomView(next, playerId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update room." }, { status: error instanceof RoomError ? error.status : 500 });
  }
}
