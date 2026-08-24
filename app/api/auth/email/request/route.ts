import { NextResponse } from "next/server";
import { getUserByEmail, upsertEmail2faCode } from "../../../../lib/db";
import { generateSixDigitCode, hashCode, isValidEmail, normalizeEmail, sendEmail2faCode } from "../../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Passwordless email sign-in: send a 6-digit code to the account's email.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const row = await getUserByEmail(email);
  if (!row) return NextResponse.json({ error: "No account with this email. Register first." }, { status: 404 });

  // In production the code must be delivered by email — never returned to the caller.
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Email delivery is not configured yet." }, { status: 503 });
  }

  const code = generateSixDigitCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await upsertEmail2faCode(row.id, hashCode(code), expiresAt);
  const { devCode } = await sendEmail2faCode(email, code);
  return NextResponse.json({ ok: true, devCode });
}
