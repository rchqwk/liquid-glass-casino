import { NextResponse } from "next/server";
import {
  applyAction,
  dealRoom,
  loadRoom,
  nextRound,
  persistRoomXp,
  resetRoom,
  roomView,
  saveRoom,
  type RoomAction,
  type SupportId,
} from "../../../../../lib/roguelikeRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: RoomAction[] = ["hit", "stand", "double", "split", "gift"];

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
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

  const room = await loadRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  if (action === "deal") {
    if (room.phase === "lobby" || room.phase === "reveal") {
      await saveRoom(dealRoom(room));
      return NextResponse.json({ room: roomView(room, playerId) });
    }
    return NextResponse.json({ error: "Cannot deal now." }, { status: 409 });
  }

  if (action === "next") {
    if (room.phase === "reveal") {
      await saveRoom(nextRound(room));
      return NextResponse.json({ room: roomView(room, playerId) });
    }
    return NextResponse.json({ error: "Cannot start next round yet." }, { status: 409 });
  }

  if (action === "reset") {
    if (room.hostId !== playerId) return NextResponse.json({ error: "Only the host can reset the run." }, { status: 403 });
    await saveRoom(resetRoom(room));
    return NextResponse.json({ room: roomView(room, playerId) });
  }

  if (!ACTIONS.includes(action as RoomAction)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { room: next, error } = applyAction(room, playerId, action as RoomAction, {
    targetId: body?.targetId ? String(body.targetId).slice(0, 64) : undefined,
    supportId: body?.supportId ? (String(body.supportId) as SupportId) : undefined,
  });
  if (error) return NextResponse.json({ error }, { status: 409 });
  if (next.runEnded && next.xp) {
    await persistRoomXp(next);
  }
  await saveRoom(next);
  return NextResponse.json({ room: roomView(next, playerId) });
}
