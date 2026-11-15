"use client";

import type { DiscordSDK } from "@discord/embedded-app-sdk";

type Login = { session_token?: string; access_token?: string; user?: unknown };
type Runtime = { sdk?: Promise<DiscordSDK>; exchanges: Map<string, Promise<Login>> };
function runtime(): Runtime {
  const host = window as Window & { __lgcDiscord?: Runtime };
  return host.__lgcDiscord ??= { exchanges: new Map() };
}

export function withDiscordTimeout<T>(promise: Promise<T>, message: string, milliseconds = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

/** '/.proxy' inside Discord (its tunnel to this site), '' in a plain browser. Same rule as the other Activities. */
export function discordApiBase(): string {
  try { return /\.discordsays\.com$/i.test(window.location.hostname ?? "") ? "/.proxy" : ""; }
  catch { return ""; }
}

/** The build's application id, else the server's copy (for builds that did not bake NEXT_PUBLIC_* in). */
export async function resolveDiscordClientId(): Promise<string> {
  const baked = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK;
  if (baked) return baked;
  try {
    const res = await fetch(`${discordApiBase()}/api/discord/config`, { cache: "no-store" });
    if (!res.ok) return "";
    const cfg = (await res.json()) as { clientId?: string };
    return cfg.clientId ?? "";
  } catch {
    return "";
  }
}

export type DiscordActivitySignIn = {
  sdk: DiscordSDK;
  channelId: string | null;
  instanceId: string;
  login: Login;
  user: { id: string; name: string } | null;
};

/**
 * Embedded App SDK sign-in, the same sequence dirt-duel / tarot-table / cratered use:
 * ready() -> authorize(identify, prompt none) -> server token exchange -> authenticate().
 * The server exchange here also returns the casino session token.
 */
export async function signInWithDiscordActivity(onStage: (text: string) => void = () => {}): Promise<DiscordActivitySignIn> {
  onStage("Waiting for Discord…");
  const clientId = await resolveDiscordClientId();
  if (!clientId) throw new Error("No Discord application id: set NEXT_PUBLIC_DISCORD_CLIENT_ID (or DISCORD_CLIENT_ID on the server).");
  const sdk = await getDiscordSdk(clientId);
  await withDiscordTimeout(
    sdk.ready(),
    "Discord did not answer. Open the table from the Activity inside Discord, and check that the Activities URL mapping points at this site.",
    15000,
  );

  onStage("Approve the sign-in in Discord if it asks…");
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });
  if (!code) throw new Error("Discord authorize did not return a code.");

  onStage("Signing you in…");
  const login = await exchangeDiscordCode(code, null, null, true);

  let user: DiscordActivitySignIn["user"] = null;
  if (login.access_token) {
    try {
      const auth = await withDiscordTimeout(sdk.commands.authenticate({ access_token: login.access_token }), "Discord authentication timed out.");
      if (auth?.user) user = { id: auth.user.id, name: auth.user.global_name || auth.user.username };
    } catch (err) {
      // The casino session is already issued; only SDK features (presence) depend on this.
      console.warn("[discord] authenticate failed", err);
    }
  }
  try { sessionStorage.removeItem("lgc.discord.paired"); } catch { /* Not needed for SDK sign-in. */ }

  return { sdk, channelId: sdk.channelId ?? discordLaunchParams().get("channel_id"), instanceId: sdk.instanceId, login, user };
}

// One SDK/READY handshake per mounted Activity iframe, including route changes/HMR.
export function getDiscordSdk(clientId: string): Promise<DiscordSDK> {
  const state = runtime();
  return state.sdk ??= import("@discord/embedded-app-sdk").then(({ DiscordSDK }) => new DiscordSDK(clientId));
}

export function discordLaunchParams(): URLSearchParams {
  const current = new URLSearchParams(window.location.search);
  if (current.has("frame_id") || current.has("instance_id")) return current;
  try { return new URLSearchParams(sessionStorage.getItem("lgc.discord.qs") ?? ""); }
  catch { return current; }
}

export async function getDiscordCall() {
  const params = discordLaunchParams();
  // Browser pairing restores the account even when Discord's mobile RPC is unavailable.
  // Keep multiplayer working from the retained call context in that case.
  try {
    if (sessionStorage.getItem("lgc.discord.paired") === "1" && params.get("channel_id")) {
      return { sdk: null, channelId: params.get("channel_id")!, instanceId: params.get("instance_id") ?? "" };
    }
  } catch { /* Continue with the Embedded SDK handshake. */ }
  if (!params.has("frame_id")) return null;
  const clientId = await resolveDiscordClientId();
  if (!clientId) throw new Error("Discord Activity is not configured.");
  const sdk = await getDiscordSdk(clientId);
  await withDiscordTimeout(sdk.ready(), "Discord is taking too long to connect. Reopen the Activity or retry.");
  const channelId = sdk.channelId ?? params.get("channel_id");
  if (!channelId) throw new Error("Open this Activity from a Discord call to play together.");
  return { sdk, channelId, instanceId: sdk.instanceId };
}

export function exchangeDiscordCode(code: string, redirectUri: string | null, mobileAuthCode?: string | null, sdk = false): Promise<Login> {
  const state = runtime();
  const key = JSON.stringify([code, redirectUri, mobileAuthCode, sdk]);
  const existing = state.exchanges.get(key);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`${discordApiBase()}/api/discord/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, redirectUri, mobileAuthCode, sdk }), signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok || !data.session_token) throw new Error(data.detail ? `${data.error}: ${data.detail}` : (data.error ?? "Discord login did not return a session."));
    return data as Login;
  })();
  state.exchanges.set(key, request);
  return request;
}

export function discordReturnPath(value: string | null | undefined): string {
  if (/^\d{15,22}$/.test(value ?? "")) return `/casino/blackjack-v2/${value}`;
  if (!value?.startsWith("/") || value.startsWith("//")) return "/casino/blackjack-v2";
  const path = new URL(value, "https://rchqwk.com");
  if (path.origin !== "https://rchqwk.com" || path.pathname.endsWith("/discord") || path.pathname === "/discord/callback") return "/casino/blackjack-v2";
  for (const key of ["code", "state", "frame_id", "instance_id", "platform", "guild_id", "channel_id"]) path.searchParams.delete(key);
  return `${path.pathname}${path.search}${path.hash}`;
}
