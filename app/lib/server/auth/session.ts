import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION } from "../../shared/constants";

export async function getSessionToken(): Promise<string | null> {
  const c = await cookies();
  const fromCookie = c.get(SESSION.TOKEN_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const h = await headers();
  return h.get(SESSION.TOKEN_HEADER);
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION.TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION.TOKEN_COOKIE);
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION.TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

export function newSessionToken(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}
