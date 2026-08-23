import { NextResponse } from "next/server";
import { setSessionToken } from "../../../lib/authServer";
import { activatePasswordSession, registerUserWithPassword } from "../../../lib/db";
import {
  generateSessionToken,
  hashPasscode,
  hashPassword,
  isValidEmail,
  isValidPasscode,
  normalizeEmail,
} from "../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string; passcode?: string; email?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const passcode = String(body?.passcode ?? "");
  const emailRaw = String(body?.email ?? "").trim();

  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3-24 letters, numbers or underscores." }, { status: 400 });
  }

  const usingPasscode = passcode.length > 0;
  if (!usingPasscode && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters (or use a 6-digit passcode)." }, { status: 400 });
  }
  if (usingPasscode && !isValidPasscode(passcode)) {
    return NextResponse.json({ error: "Passcode must be exactly 6 digits." }, { status: 400 });
  }

  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  // Store whichever credential was provided (password OR passcode).
  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;
  let passcodeHash: string | null = null;
  let passcodeSalt: string | null = null;
  if (usingPasscode) {
    const h = hashPasscode(passcode);
    passcodeHash = h.hash;
    passcodeSalt = h.salt;
  } else {
    const h = hashPassword(password);
    passwordHash = h.hash;
    passwordSalt = h.salt;
  }

  const user = await registerUserWithPassword({
    username,
    passwordHash,
    passwordSalt,
    passcodeHash,
    passcodeSalt,
    email,
  });
  if (!user) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  const token = generateSessionToken();
  await activatePasswordSession(user.id, token);
  await setSessionToken(token);
  return NextResponse.json({ user });
}
