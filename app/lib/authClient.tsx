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

function getDiscordUsernameModeDisabled() {
  try {
    return sessionStorage.getItem("lgc.discord.disableOauthSession") === "1";
  } catch {
    return false;
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
  reportResult: (input: { game: string; profit: number; wager: number; baseWager?: number; balance?: number }) => Promise<void>;
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
      sessionStorage.removeItem("lgc.discord.disableOauthSession");
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
        const disableDiscordOauthSession = getDiscordUsernameModeDisabled();
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
          if (disableDiscordOauthSession) isDiscord = false;
        } catch {
          // ignore
        }
        setDiscordMode(isDiscord);

        const res = await fetchWithDevice("/api/auth", { cache: "no-store" });
        const data = (await res.json()) as { user: UserWithRole | null };
        const authed = data.user ?? null;
        setUser(authed);

        // Inside Discord, hand off unauthenticated users to the dedicated controller page.
        // Keep the auth implementation in one place instead of duplicating it here.
        if (!authed && isDiscord && !discordAttempted) {
          setDiscordAttempted(true);
          setDiscordError(null);
          try {
            const path = window.location.pathname || "";
            if (!path.startsWith("/casino/blackjack/discord")) {
              window.location.replace(`/casino/blackjack/discord${search || ""}`);
              return;
            }
          } catch (e: any) {
            setDiscordError(String(e?.message ?? "Failed to open Discord sign-in."));
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
      reportResult: async ({ game, profit, wager, baseWager, balance }) => {
        if (!user) return;
        if (!Number.isFinite(profit) || !Number.isFinite(wager)) return;
        try {
          await fetchWithDevice("/api/leaderboard/report", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ game, profit, wager, baseWager, balance }),
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
