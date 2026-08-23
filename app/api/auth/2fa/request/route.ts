import { NextResponse } from "next/server";
import { getUserAuthRow, upsertEmail2faCode } from "../../../../lib/db";
import { generateSixDigitCode, hashCode, sendEmail2faCode } from "../../../../lib/passwordAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  const username = String(body?.username ?? "").trim();
  if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });

  const row = await getUserAuthRow(username);
  if (!row) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!row.email) return NextResponse.json({ error: "No email is linked to this account." }, { status: 400 });

  // In production the code must be delivered by email — never returned to the caller.
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Email delivery is not configured yet. Contact the site owner." }, { status: 503 });
    }
  }

  const code = generateSixDigitCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await upsertEmail2faCode(row.id, hashCode(code), expiresAt);
  const { devCode } = await sendEmail2faCode(row.email, code);
  return NextResponse.json({ ok: true, devCode });
}
