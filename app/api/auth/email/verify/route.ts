import { NextResponse } from "next/server";
import { setSessionToken } from "../../../../lib/authServer";
import {
  activatePasswordSession,
  deleteEmail2faCode,
  getEmail2faCode,
  getUserByEmail,
  resetLoginFailures,
} from "../../../../lib/db";
import { generateSessionToken, isValidEmail, normalizeEmail, verifyCode } from "../../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Passwordless email sign-in: verify the 6-digit code and sign in.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  const code = String(body?.code ?? "").trim();
  if (!isValidEmail(email) || !code) return NextResponse.json({ error: "Email and code required." }, { status: 400 });

  const row = await getUserByEmail(email);
  if (!row) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const stored = await getEmail2faCode(row.id);
  if (!stored) return NextResponse.json({ error: "No code requested. Request a new code." }, { status: 400 });
  if (Date.now() > stored.expires_at) {
    await deleteEmail2faCode(row.id);
    return NextResponse.json({ error: "Code expired. Request a new code." }, { status: 400 });
  }
  if (!verifyCode(code, stored.code_hash)) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  await deleteEmail2faCode(row.id);
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
