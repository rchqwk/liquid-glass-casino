import { NextResponse } from "next/server";
import crypto from "crypto";
import { setSessionToken } from "../../../../lib/authServer";
import {
  completeDiscordAuthTransaction,
  createOrGetDiscordLinkedUser,
  discordSetActiveSession,
  failDiscordAuthTransaction,
  getDiscordAuthTransactionById,
  setUserRoleAtLeast,
} from "../../../../lib/db";

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
  const body = (await req.json().catch(() => null)) as
    | { transactionId?: string; code?: string; redirectUri?: string }
    | null;

  const transactionId = String(body?.transactionId ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!transactionId) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const tx = await getDiscordAuthTransactionById(transactionId);
  if (!tx) return NextResponse.json({ error: "Auth transaction not found" }, { status: 404 });
  if (tx.status === "completed") {
    return NextResponse.json({ error: "Auth transaction already completed" }, { status: 409 });
  }
  if (tx.status !== "pending") {
    return NextResponse.json({ error: `Auth transaction is ${tx.status}` }, { status: 400 });
  }
  if (tx.expiresAt < Date.now()) {
    await failDiscordAuthTransaction({ id: tx.id, error: "Auth transaction expired" });
    return NextResponse.json({ error: "Auth transaction expired" }, { status: 410 });
  }

  try {
    const clientId = requireEnv("DISCORD_CLIENT_ID");
    const clientSecret = requireEnv("DISCORD_CLIENT_SECRET");
    const redirectUri =
      String(body?.redirectUri ?? "").trim()
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
      throw new Error(
        `Discord token exchange failed${tokenJson && "error" in tokenJson && tokenJson.error ? `: ${tokenJson.error}` : ""}`,
      );
    }

    const accessToken = (tokenJson as any).access_token as string;
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const me = (await meRes.json().catch(() => null)) as DiscordMe | null;
    if (!meRes.ok || !me?.id) throw new Error("Discord user lookup failed");

    const display = String(me.global_name ?? me.username ?? "discord_user");
    const avatarUrl = discordAvatarUrl(me.id, me.avatar ?? null);
    const linked = await createOrGetDiscordLinkedUser({ discordId: me.id, displayName: display, avatarUrl });
    const resolvedRole =
      tx.source === "activity" && tx.platform === "mobile"
        ? await setUserRoleAtLeast(linked.id, 1)
        : Number(linked.role_level ?? 0);

    const sessionToken = randomToken();
    await discordSetActiveSession(linked.id, sessionToken);
    await setSessionToken(sessionToken);
    const completedTx = await completeDiscordAuthTransaction({
      id: tx.id,
      userId: linked.id,
      sessionToken,
    });

    return NextResponse.json({
      ok: true,
      access_token: accessToken,
      session_token: sessionToken,
      user: { ...linked, role_level: resolvedRole },
      transaction: completedTx ?? tx,
      discord: { id: me.id, username: me.username, global_name: me.global_name ?? null },
    });
  } catch (e: any) {
    const message = String(e?.message ?? "Discord auth completion failed");
    await failDiscordAuthTransaction({ id: tx.id, error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

