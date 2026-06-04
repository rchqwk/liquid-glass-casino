import { cookies, headers } from "next/headers";
import { getUserBySessionToken } from "./db";

const COOKIE_NAME = "lgc_session";

export async function getSessionToken() {
  // Support header-based session tokens for environments where third-party cookies are blocked
  // (notably Discord iOS in an embedded webview).
  try {
    const h = await headers();
    const token = h.get("x-lgc-session") || "";
    if (token) return token;
    const auth = h.get("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  } catch {
    // ignore
  }
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function setSessionToken(token: string) {
  const c = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const isVercel = !!process.env.VERCEL;
  // Discord Activities run in an embedded iframe. To persist login across navigation,
  // the session cookie must be allowed in a third-party context.
  const sameSite = isProd && isVercel ? ("none" as const) : ("lax" as const);
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite,
    secure: sameSite === "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
  });
}

export async function clearSessionToken() {
  const c = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const isVercel = !!process.env.VERCEL;
  const sameSite = isProd && isVercel ? ("none" as const) : ("lax" as const);
  c.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite,
    secure: sameSite === "none",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthedUserAsync() {
  const token = await getSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
}
