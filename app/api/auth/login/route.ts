import { NextResponse } from "next/server";
import { setSessionToken } from "../../../lib/authServer";
import { activatePasswordSession, getUserAuthRow, recordLoginFailure, resetLoginFailures } from "../../../lib/db";
import { generateSessionToken, isValidPasscode, verifyPasscode, verifyPassword } from "../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string; passcode?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const passcode = String(body?.passcode ?? "");

  // Explicit: passcode auth when a `passcode` field is provided, otherwise password.
  const usingPasscode = passcode.length > 0;
  const credential = usingPasscode ? passcode : password;

  if (!username || !credential) {
    return NextResponse.json({ error: "Username and password/passcode required." }, { status: 400 });
  }
  if (usingPasscode && !isValidPasscode(credential)) {
    return NextResponse.json({ error: "Passcode must be exactly 6 digits." }, { status: 400 });
  }

  const row = await getUserAuthRow(username);
  if (!row) {
    return NextResponse.json({ error: "Invalid username or credential." }, { status: 401 });
  }

  if (row.locked_until > Date.now()) {
    return NextResponse.json({ error: "Account locked.", lockedUntil: row.locked_until, needs2fa: true }, { status: 423 });
  }

  const ok = usingPasscode
    ? row.passcode_hash != null && row.passcode_salt != null && verifyPasscode(credential, row.passcode_hash, row.passcode_salt)
    : row.password_hash != null && row.password_salt != null && verifyPassword(credential, row.password_hash, row.password_salt);

  if (!ok) {
    const { failedAttempts, lockedUntil } = await recordLoginFailure(username, MAX_ATTEMPTS, LOCKOUT_MS);
    if (lockedUntil > 0) {
      return NextResponse.json(
        { error: "Too many attempts. Account locked for 4 hours.", lockedUntil, needs2fa: true },
        { status: 423 },
      );
    }
    return NextResponse.json({ error: "Invalid username or credential.", attemptsLeft: MAX_ATTEMPTS - failedAttempts }, { status: 401 });
  }

  await resetLoginFailures(row.id);
  const token = generateSessionToken();
  await activatePasswordSession(row.id, token);
  await setSessionToken(token);
  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      role_level: row.role_level,
      prestige_level: row.prestige_level,
      prestige_points: row.prestige_points,
      name_color: row.name_color,
      xp: row.xp,
    },
  });
}
