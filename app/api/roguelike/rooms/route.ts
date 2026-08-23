import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { createRoom, generateRoomCode, loadRoom, roomView, saveRoom, type RoomMode } from "../../../lib/roguelikeRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { playerId?: string; username?: string; mode?: string } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);
  const username = String(body?.username ?? "Player").slice(0, 24);
  const mode: RoomMode = body?.mode === "race" || body?.mode === "elimination" ? body.mode : "coop";
  if (!playerId) return NextResponse.json({ error: "playerId required." }, { status: 400 });

  // Link the room seat to the signed-in account (for XP persistence).
  const authed = await getAuthedUserAsync().catch(() => null);
  const userId = authed?.id ?? null;

  // Generate a unique code.
  let code = generateRoomCode();
  for (let i = 0; i < 5; i += 1) {
    if (!(await loadRoom(code))) break;
    code = generateRoomCode();
  }

  const room = createRoom(code, playerId, username, mode, userId);
  await saveRoom(room);
  return NextResponse.json({ room: roomView(room, playerId) });
}
