import { NextResponse } from "next/server";
import { setSessionToken } from "../../../lib/authServer";
import { activatePasswordSession, getUserAuthRow, hasUserProgress, setUserCredential } from "../../../lib/db";
import { generateSessionToken, hashPasscode, hashPassword, isValidEmail, isValidPasscode, normalizeEmail } from "../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets an existing, progressed, unprotected account set a password or passcode and sign in.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string; passcode?: string; email?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const passcode = String(body?.passcode ?? "");
  const emailRaw = String(body?.email ?? "").trim();

  if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });

  const row = await getUserAuthRow(username);
  if (!row) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const progress = await hasUserProgress(row.id);
  if (!progress) return NextResponse.json({ error: "This account has no progress; sign in normally." }, { status: 400 });

  const hasPassword = !!(row.password_hash && row.password_salt);
  const hasPasscode = !!(row.passcode_hash && row.passcode_salt);
  if (hasPassword || hasPasscode) {
    return NextResponse.json({ error: "This account already has a credential. Sign in instead." }, { status: 409 });
  }

  const usingPasscode = passcode.length > 0;
  if (!usingPasscode && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters (or use a 6-digit passcode)." }, { status: 400 });
  }
  if (usingPasscode && !isValidPasscode(passcode)) {
    return NextResponse.json({ error: "Passcode must be exactly 6 digits." }, { status: 400 });
  }

  const email = emailRaw ? normalizeEmail(emailRaw) : row.email;
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const fields: { password_hash?: string; password_salt?: string; passcode_hash?: string; passcode_salt?: string } = {};
  if (usingPasscode) {
    const h = hashPasscode(passcode);
    fields.passcode_hash = h.hash;
    fields.passcode_salt = h.salt;
  } else {
    const h = hashPassword(password);
    fields.password_hash = h.hash;
    fields.password_salt = h.salt;
  }
  await setUserCredential(row.id, fields);

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
