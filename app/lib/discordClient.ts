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

// One SDK/READY handshake per mounted Activity iframe, including route changes/HMR.
export function getDiscordSdk(clientId: string): Promise<DiscordSDK> {
  const state = runtime();
  return state.sdk ??= import("@discord/embedded-app-sdk").then(({ DiscordSDK }) => new DiscordSDK(clientId));
}

export function exchangeDiscordCode(code: string, redirectUri: string, mobileAuthCode?: string | null): Promise<Login> {
  const state = runtime();
  const key = JSON.stringify([code, redirectUri, mobileAuthCode]);
  const existing = state.exchanges.get(key);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch("/api/discord/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, redirectUri, mobileAuthCode }), signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok || !data.session_token) throw new Error(data.error ?? "Discord login did not return a session.");
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
