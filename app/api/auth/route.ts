import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { clearSessionToken, getAuthedUserAsync, setSessionToken } from "../../lib/authServer";
import { getUserAuthRow, hasUserProgress, loginUsernameWithToken, normalizeUsername, signOutByToken } from "../../lib/db";

function fingerprintFromRequest(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const device = req.headers.get("x-lgc-device") ?? "";
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const raw = `${device}|${ua}|${ip}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function GET() {
  const user = await getAuthedUserAsync();
  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  try {
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

    // Progress gate: usernames that have accumulated progress must be protected
    // by a password or a 6-digit passcode. Otherwise username-only login applies.
    const existing = await getUserAuthRow(username);
    if (existing) {
      const progress = await hasUserProgress(existing.id);
      if (progress) {
        const hasPassword = !!(existing.password_hash && existing.password_salt);
        const hasPasscode = !!(existing.passcode_hash && existing.passcode_salt);
        if (hasPassword || hasPasscode) {
          return NextResponse.json(
            {
              requiresAuth: true,
              hasPassword,
              hasPasscode,
              error: "Enter your password or passcode to continue.",
            },
            { status: 401 },
          );
        }
        return NextResponse.json(
          {
            requiresClaim: true,
            error: "This account has progress but no password or passcode yet. Set one to secure it.",
          },
          { status: 403 },
        );
      }
    }

    // Create session token
    const token = crypto.randomBytes(24).toString("hex");
    const fingerprint = fingerprintFromRequest(req);

    const res = await loginUsernameWithToken({
      username,
      token,
      fingerprint,
      lockReleaseMs: 24 * 60 * 60 * 1000,
      inactiveCutoffMs: Date.now() - 30 * 24 * 60 * 60 * 1000,
    });

    await setSessionToken(token);
    return NextResponse.json({
      user: res.user,
      inactivePrompt: res.inactivePrompt,
      session_token: token,
    });
  } catch (e: any) {
    // Always return JSON so the client doesn't throw while parsing.
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    const status =
      msg.includes("currently in use") || msg.includes("locked") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE() {
  // best-effort server-side session invalidation
  try {
    const token = (await cookies()).get("lgc_session")?.value;
    if (token) await signOutByToken(token);
  } catch {
    // ignore
  }
  await clearSessionToken();
  return NextResponse.json({ ok: true });
}
