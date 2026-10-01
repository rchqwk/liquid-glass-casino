import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { activeDiscordRoom, discordRoomCode, joinDiscordRoom } from "../../../lib/roguelikeDiscord";
import { loadRoom, RoomError, roomView } from "../../../lib/roguelikeRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!await getAuthedUserAsync()) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  try {
    const channelId = new URL(req.url).searchParams.get("channelId") ?? "";
    const room = await loadRoom(discordRoomCode(channelId));
    return NextResponse.json({ active: room?.discordChannelId === channelId && activeDiscordRoom(room) });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || "")) return NextResponse.json({ error: "JSON request required." }, { status: 415 });
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  const body = await req.json().catch(() => null) as { channelId?: string } | null;
  try {
    const room = await joinDiscordRoom(String(body?.channelId ?? ""), user);
    return NextResponse.json({ room: roomView(room, `u${user.id}`) });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof RoomError ? error.message : "Could not connect to the Discord room. Please retry." }, { status: error instanceof RoomError ? error.status : 500 });
}
