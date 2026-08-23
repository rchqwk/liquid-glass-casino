import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { joinRoom, loadRoom, roomView, saveRoom } from "../../../../../lib/roguelikeRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { playerId?: string; username?: string } | null;
  const playerId = String(body?.playerId ?? "").slice(0, 64);
  const username = String(body?.username ?? "Player").slice(0, 24);
  if (!playerId) return NextResponse.json({ error: "playerId required." }, { status: 400 });

  const room = await loadRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  // Link the room seat to the signed-in account (for XP persistence).
  const authed = await getAuthedUserAsync().catch(() => null);
  const userId = authed?.id ?? null;

  const { room: next, error } = joinRoom(room, playerId, username, userId);
  if (error) return NextResponse.json({ error }, { status: 409 });
  await saveRoom(next);
  return NextResponse.json({ room: roomView(next, playerId) });
}
