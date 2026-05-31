import { cookies } from "next/headers";
import { getUserBySessionToken } from "./db";

const COOKIE_NAME = "lgc_session";

export async function getSessionToken() {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

export async function setSessionToken(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
  });
}

export async function clearSessionToken() {
  const c = await cookies();
  c.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthedUserAsync() {
  const token = await getSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
}
