// Password + email-2FA helpers (server-only).
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const candidate = scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateSixDigitCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyCode(code: string, hash: string): boolean {
  return hashCode(code) === hash;
}

// Sends a 6-digit code via Resend if configured, otherwise logs it (dev).
export async function sendEmail2faCode(to: string, code: string): Promise<{ devCode: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Liquid Glass Arcade <noreply@games.rchqwk.com>";
  if (apiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: "Your Liquid Glass Arcade login code",
          html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
        }),
      });
    } catch {
      // fall through to dev code
    }
    return { devCode: null };
  }
  // eslint-disable-next-line no-console
  console.log(`[email-2fa] code for ${to}: ${code}`);
  return { devCode: process.env.NODE_ENV === "production" ? null : code };
}

export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase().slice(0, 200);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}
