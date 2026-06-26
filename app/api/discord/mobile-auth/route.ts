import { NextResponse } from "next/server";
import { createDiscordMobileAuth, getDiscordMobileAuthByToken } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { channelId?: string | null } | null;
  const created = await createDiscordMobileAuth({ channelId: body?.channelId ?? null });
  return NextResponse.json({ ok: true, ...created });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") ?? "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const rec = await getDiscordMobileAuthByToken(token);
  if (!rec) return NextResponse.json({ error: "Auth request not found or expired" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    status: rec.sessionToken ? "completed" : "pending",
    token: rec.token,
    code: rec.code,
    channelId: rec.channelId,
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
    completedAt: rec.completedAt,
    sessionToken: rec.sessionToken,
  });
}

