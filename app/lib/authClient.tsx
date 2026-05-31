"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = { id: number; username: string };
type UserWithRole = { id: number; username: string; role_level: number };

type AuthContextValue = {
  user: UserWithRole | null;
  loading: boolean;
  signIn: (username: string) => Promise<{ ok: true } | { ok: false; error: string }>;
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
        const res = await fetch("/api/auth", { cache: "no-store" });
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
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username }),
          });
          const data = (await res.json()) as
            | { user: UserWithRole }
            | { error: string };
          if (!res.ok) return { ok: false, error: ("error" in data ? data.error : "Sign-in failed") };
          if ("user" in data) setUser(data.user);
          return { ok: true };
        } catch {
          return { ok: false, error: "Network error" };
        }
      },
      signOut: async () => {
        try {
          await fetch("/api/auth", { method: "DELETE" });
        } finally {
          setUser(null);
        }
      },
      reportResult: async ({ game, profit, wager }) => {
        if (!user) return;
        if (!Number.isFinite(profit) || !Number.isFinite(wager)) return;
        try {
          await fetch("/api/leaderboard/report", {
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
