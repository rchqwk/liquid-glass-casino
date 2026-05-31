"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = { id: number; username: string };
type UserWithRole = { id: number; username: string; role_level: number };

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

async function fetchWithDevice(input: RequestInfo, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? {});
  const id = getDeviceId();
  if (id) headers.set("x-lgc-device", id);
  return fetch(input, { ...init, headers });
}

type AuthContextValue = {
  user: UserWithRole | null;
  loading: boolean;
  signIn: (
    username: string,
  ) => Promise<
    | { ok: true; inactivePrompt?: boolean }
    | { ok: false; error: string }
  >;
  signOut: () => Promise<void>;
  reportResult: (input: { game: string; profit: number; wager: number }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithDevice("/api/auth", { cache: "no-store" });
        const data = (await res.json()) as { user: UserWithRole | null };
        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      signIn: async (username) => {
        try {
          const res = await fetchWithDevice("/api/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username }),
          });
          const data = (await res.json()) as
            | { user: UserWithRole; inactivePrompt?: boolean }
            | { error: string };
          if (!res.ok) return { ok: false, error: ("error" in data ? data.error : "Sign-in failed") };
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
          setUser(null);
        }
      },
      reportResult: async ({ game, profit, wager }) => {
        if (!user) return;
        if (!Number.isFinite(profit) || !Number.isFinite(wager)) return;
        try {
          await fetchWithDevice("/api/leaderboard/report", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ game, profit, wager }),
          });
        } catch {
          // ignore
        }
      },
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
