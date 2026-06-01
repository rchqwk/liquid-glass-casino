import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { addGlobalChatMessage, getGlobalChatMessages, getPresenceCounts, touchUserLastSeen } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await touchUserLastSeen(user.id);
  const [messages, counts] = await Promise.all([getGlobalChatMessages(120), getPresenceCounts()]);
  return NextResponse.json({ messages, online: counts.online, active1h: counts.active1h });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  if (text.length > 240) return NextResponse.json({ error: "Message too long." }, { status: 400 });

  await touchUserLastSeen(user.id);
  await addGlobalChatMessage({ userId: user.id, username: user.username, text });
  const [messages, counts] = await Promise.all([getGlobalChatMessages(120), getPresenceCounts()]);
  return NextResponse.json({ messages, online: counts.online, active1h: counts.active1h });
}

