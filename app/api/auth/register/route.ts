import { NextResponse } from "next/server";
import { setSessionToken } from "../../../lib/authServer";
import { activatePasswordSession, registerUserWithPassword } from "../../../lib/db";
import { generateSessionToken, hashPassword, isValidEmail, normalizeEmail } from "../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string; email?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const emailRaw = String(body?.email ?? "").trim();

  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3-24 letters, numbers or underscores." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { hash, salt } = hashPassword(password);
  const user = await registerUserWithPassword({ username, passwordHash: hash, passwordSalt: salt, email });
  if (!user) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  const token = generateSessionToken();
  await activatePasswordSession(user.id, token);
  await setSessionToken(token);
  return NextResponse.json({ user });
}
