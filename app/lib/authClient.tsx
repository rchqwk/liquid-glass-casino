"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = { id: number; username: string };
type UserWithRole = {
  id: number;
  username: string;
  role_level: number;
  prestige_level?: number;
  prestige_points?: number;
  name_color?: string | null;
};

function getDeviceId() {
  try {
    const key = "lgc.deviceId.v1";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = Math.random().toString(16).slice(2) + Date.now().toString(16);
    localStorage.setItem(key, id);
    return id;
  } catch {
    return "";
  }
}

function getSessionTokenClient() {
  try {
    return localStorage.getItem("lgc.session") || "";
  } catch {
    return "";
  }
}

async function fetchWithDevice(input: RequestInfo, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  const id = getDeviceId();
  if (id) headers.set("x-lgc-device", id);
  const sess = getSessionTokenClient();
  if (sess && !headers.has("x-lgc-session")) headers.set("x-lgc-session", sess);
  return fetch(input, { ...init, headers });
}

type AuthContextValue = {
  user: UserWithRole | null;
  loading: boolean;
  discordMode: boolean;
  discordError: string | null;
  retryDiscord: () => void;
  refresh: () => Promise<void>;
  signIn: (
    username: string,
  ) => Promise<
    | { ok: true; inactivePrompt?: boolean }
    | { ok: false; error: string }
  >;
  signOut: () => Promise<void>;
  reportResult: (input: { game: string; profit: number; wager: number; balance?: number }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordMode, setDiscordMode] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [discordAttempted, setDiscordAttempted] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetchWithDevice("/api/auth", { cache: "no-store" });
      const data = (await res.json()) as { user: UserWithRole | null };
      setUser(data.user ?? null);
    } catch {
      // ignore
    }
  };

  const retryDiscord = () => {
    try {
      const qs = sessionStorage.getItem("lgc.discord.qs") ?? "";
      window.location.href = `/casino/blackjack/discord${qs || ""}`;
    } catch {
      window.location.href = "/casino/blackjack/discord";
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Patch global fetch to always include the session token header if present.
        // This makes the whole app work in environments where cookies are blocked (Discord iOS).
        try {
          const w = window as any;
          if (!w.__lgcFetchWrapped) {
            w.__lgcFetchWrapped = true;
            const orig = window.fetch.bind(window);
            window.fetch = (input: any, init?: any) => {
              try {
                const sess = getSessionTokenClient();
                if (sess) {
                  const headers = new Headers(init?.headers ?? {});
                  if (!headers.has("x-lgc-session")) headers.set("x-lgc-session", sess);
                  init = { ...(init ?? {}), headers };
                }
              } catch {
                // ignore
              }
              return orig(input, init);
            };
          }
        } catch {
          // ignore
        }

        // Detect Discord embedded environment (frame_id etc). If present, persist for later navigation.
        let isDiscord = false;
        let search = "";
        try {
          search = window.location.search ?? "";
          const sp = new URLSearchParams(search);
          isDiscord =
            sp.has("frame_id") ||
            sp.has("instance_id") ||
            sp.has("platform") ||
            sp.has("guild_id") ||
            sp.has("channel_id");
          if (isDiscord) {
            sessionStorage.setItem("lgc.discord.embedded", "1");
            sessionStorage.setItem("lgc.discord.qs", search);
          } else {
            isDiscord = sessionStorage.getItem("lgc.discord.embedded") === "1";
          }
        } catch {
          // ignore
        }
        setDiscordMode(isDiscord);

        const res = await fetchWithDevice("/api/auth", { cache: "no-store" });
        const data = (await res.json()) as { user: UserWithRole | null };
        const authed = data.user ?? null;
        setUser(authed);

        // If we're inside Discord and not authed yet, automatically sign-in via Embedded App SDK.
        if (!authed && isDiscord && !discordAttempted) {
          setDiscordAttempted(true);
          setDiscordError(null);

          const sp = new URLSearchParams(search);
          const hasFrameId = sp.has("frame_id");

          // Discord iOS frequently hangs during the Embedded App SDK handshake.
          // Prefer the OAuth entry flow on iOS to avoid users getting stuck at "8%".
          try {
            const ua = navigator.userAgent ?? "";
            const isIOS = /iPhone|iPad|iPod/i.test(ua);
            if (isIOS) {
              const path = window.location.pathname || "";
              if (!path.startsWith("/casino/blackjack/discord")) {
                window.location.replace(`/casino/blackjack/discord${search || ""}`);
                return;
              }
            }
          } catch {
            // ignore
          }

          if (!hasFrameId) {
            // Some Discord contexts (notably iOS/webview) may omit `frame_id`, which prevents the Embedded App SDK
            // from initializing. In that case, fall back to the dedicated Discord entry page which provides an
            // OAuth authorize link and can still complete login with `code` + `channel_id`.
            try {
              const path = window.location.pathname || "";
              if (!path.startsWith("/casino/blackjack/discord")) {
                window.location.replace(`/casino/blackjack/discord${search || ""}`);
                return;
              }
            } catch {
              // ignore
            }
            setDiscordError("Discord embed params are missing (frame_id). Tap Retry to use OAuth sign-in.");
          } else {
            const clientId =
              process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ??
              process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ??
              "";
            const redirectUri =
              process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ??
              "https://rchqwk-liquid-glass-casino.vercel.app/casino/blackjack/discord";
            if (!clientId) {
              setDiscordError("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID.");
            } else {
              try {
                const { DiscordSDK } = await import("@discord/embedded-app-sdk");
                // eslint-disable-next-line new-cap
                const sdk = new DiscordSDK(clientId);
                await Promise.race([
                  sdk.ready(),
                  new Promise((_, reject) =>
                    window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), 20000),
                  ),
                ]);
                const authz = await (sdk as any).commands.authorize({
                  client_id: clientId,
                  response_type: "code",
                  prompt: "none",
                  scope: ["identify", "rpc.activities.write"],
                });
                const code = String(authz?.code ?? "");
                if (!code) throw new Error("Discord authorize did not return a code.");

                const loginRes = await fetch("/api/discord/login", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ code, redirectUri }),
                });
                const loginJson = (await loginRes.json().catch(() => ({}))) as any;
                if (!loginRes.ok) throw new Error(loginJson?.error ?? "Discord login failed.");
                if (loginJson?.session_token) {
                  try {
                    localStorage.setItem("lgc.session", String(loginJson.session_token));
                  } catch {
                    // ignore
                  }
                }
                if (loginJson?.user) setUser(loginJson.user as UserWithRole);
              } catch (e: any) {
                const msg = String(e?.message ?? "Discord sign-in failed.");
                // iOS can get stuck during Activity initialization and never complete the RPC handshake.
                // If that happens, fall back to the OAuth entry page so the user can still play.
                if (msg.includes("handshake timed out")) {
                  try {
                    window.location.replace(`/casino/blackjack/discord${search || ""}`);
                    return;
                  } catch {
                    // ignore
                  }
                }
                setDiscordError(msg);
              }
            }
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      discordMode,
      discordError,
      retryDiscord,
      refresh,
      signIn: async (username) => {
        try {
          const res = await fetchWithDevice("/api/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username }),
          });
          const data = (await res.json()) as
            | { user: UserWithRole; inactivePrompt?: boolean; session_token?: string }
            | { error: string };
          if (!res.ok) return { ok: false, error: ("error" in data ? data.error : "Sign-in failed") };
          // Persist session token for environments where cookies may be blocked (iOS web).
          if ("session_token" in data && data.session_token) {
            try {
              localStorage.setItem("lgc.session", String(data.session_token));
            } catch {
              // ignore
            }
          }
          if ("user" in data) setUser(data.user);
          return { ok: true, inactivePrompt: "inactivePrompt" in data ? data.inactivePrompt : undefined };
        } catch {
          return { ok: false, error: "Network error" };
        }
      },
      signOut: async () => {
        try {
          await fetchWithDevice("/api/auth", { method: "DELETE" });
        } finally {
          try {
            localStorage.removeItem("lgc.session");
          } catch {
            // ignore
          }
          setUser(null);
        }
      },
      reportResult: async ({ game, profit, wager, balance }) => {
        if (!user) return;
        if (!Number.isFinite(profit) || !Number.isFinite(wager)) return;
        try {
          await fetchWithDevice("/api/leaderboard/report", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ game, profit, wager, balance }),
          });
        } catch {
          // ignore
        }
      },
    };
  }, [user, loading, discordMode, discordError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
