import { NextResponse } from "next/server";
import crypto from "crypto";
import { clearSessionToken, getAuthedUserAsync, setSessionToken } from "../../lib/authServer";
import { createSession, getOrCreateUser, normalizeUsername } from "../../lib/db";

export async function GET() {
  const user = await getAuthedUserAsync();
  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string }
    | null;
  const raw = body?.username ?? "";
  const username = normalizeUsername(raw);

  if (!username || username.length < 3 || username.length > 20) {
    return NextResponse.json(
      { error: "Username must be 3–20 chars." },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "Use only letters, numbers, underscore." },
      { status: 400 },
    );
  }

  const user = await getOrCreateUser(username);

  // Create session token
  const token = crypto.randomBytes(24).toString("hex");
  await createSession(user.id, token);

  await setSessionToken(token);
  return NextResponse.json({
    user: { id: user.id, username: user.username, role_level: user.role_level ?? 0 },
  });
}

export async function DELETE() {
  await clearSessionToken();
  return NextResponse.json({ ok: true });
}
