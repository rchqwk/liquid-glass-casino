import { NextResponse } from "next/server";
import { loadRoom, roomView } from "../../../../lib/roguelikeRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const playerId = String(url.searchParams.get("playerId") ?? "").slice(0, 64);

  const room = await loadRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  return NextResponse.json({ room: roomView(room, playerId) });
}
