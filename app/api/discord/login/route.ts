import { NextResponse } from "next/server";
import crypto from "crypto";
import { setSessionToken } from "../../../lib/authServer";
import { completeDiscordMobileAuthByCode, createOrGetDiscordLinkedUser, discordSetActiveSession, setUserRoleAtLeast } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordTokenResp =
  | {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
    }
  | { error: string; error_description?: string };

type DiscordMe = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

function discordAvatarUrl(discordId: string, avatar: string | null | undefined) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`;
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: string; redirectUri?: string; mobileAuthCode?: string } | null;
  const code = String(body?.code ?? "");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const clientId = requireEnv("DISCORD_CLIENT_ID");
  const clientSecret = requireEnv("DISCORD_CLIENT_SECRET");
  const redirectUri = String(body?.redirectUri ?? "").trim()
    || process.env.DISCORD_REDIRECT_URI
    || "https://rchqwk.com/casino/blackjack/discord";

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", redirectUri);

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const tokenJson = (await tokenRes.json().catch(() => null)) as DiscordTokenResp | null;
  if (!tokenRes.ok || !tokenJson || "error" in tokenJson || !(tokenJson as any).access_token) {
    return NextResponse.json(
      { error: "Discord token exchange failed", detail: tokenJson && "error" in tokenJson ? tokenJson.error : undefined },
      { status: 400 },
    );
  }
  const accessToken = (tokenJson as any).access_token as string;

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const me = (await meRes.json().catch(() => null)) as DiscordMe | null;
  if (!meRes.ok || !me?.id) return NextResponse.json({ error: "Discord user lookup failed" }, { status: 400 });

  const display = String(me.global_name ?? me.username ?? "discord_user");
  const avatarUrl = discordAvatarUrl(me.id, (me as any).avatar ?? null);
  const linked = await createOrGetDiscordLinkedUser({ discordId: me.id, displayName: display, avatarUrl });
  const mobileAuthCode = String(body?.mobileAuthCode ?? "").trim();
  const resolvedRole = mobileAuthCode ? await setUserRoleAtLeast(linked.id, 1) : Number(linked.role_level ?? 0);

  const sessionToken = randomToken();
  await discordSetActiveSession(linked.id, sessionToken);
  await setSessionToken(sessionToken);
  if (mobileAuthCode) {
    await completeDiscordMobileAuthByCode({ code: mobileAuthCode, userId: linked.id, sessionToken });
  }

  return NextResponse.json({
    ok: true,
    access_token: accessToken,
    session_token: sessionToken,
    user: { ...linked, role_level: resolvedRole },
    discord: { id: me.id, username: me.username, global_name: me.global_name ?? null },
  });
}
