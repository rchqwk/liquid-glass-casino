import { NextResponse } from "next/server";
import { setSessionToken } from "../../../lib/authServer";
import { activatePasswordSession, getUserAuthRow, recordLoginFailure, resetLoginFailures } from "../../../lib/db";
import { generateSessionToken, verifyPassword } from "../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });
  }

  const row = await getUserAuthRow(username);
  if (!row || !row.password_hash || !row.password_salt) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  if (row.locked_until > Date.now()) {
    return NextResponse.json({ error: "Account locked.", lockedUntil: row.locked_until, needs2fa: true }, { status: 423 });
  }

  if (!verifyPassword(password, row.password_hash, row.password_salt)) {
    const { failedAttempts, lockedUntil } = await recordLoginFailure(username, MAX_ATTEMPTS, LOCKOUT_MS);
    if (lockedUntil > 0) {
      return NextResponse.json(
        { error: "Too many attempts. Account locked for 4 hours.", lockedUntil, needs2fa: true },
        { status: 423 },
      );
    }
    return NextResponse.json({ error: "Invalid username or password.", attemptsLeft: MAX_ATTEMPTS - failedAttempts }, { status: 401 });
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
