"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface SessionState {
  userId: string | null;
  username: string | null;
  roleLevel: number;
  authenticated: boolean;
  expiresAt: number | null;
  lastActivityAt: number;
}

export interface SessionActions {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  extend: () => Promise<void>;
  recordActivity: () => void;
}

type SessionContextValue = SessionState & SessionActions;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5000;

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: Partial<SessionState>;
}) {
  const [state, setState] = useState<SessionState>({
    userId: initialSession?.userId ?? null,
    username: initialSession?.username ?? null,
    roleLevel: initialSession?.roleLevel ?? 0,
    authenticated: initialSession?.authenticated ?? false,
    expiresAt: initialSession?.expiresAt ?? null,
    lastActivityAt: Date.now(),
  });

  const recordActivity = useCallback(() => {
    setState((prev) => {
      const now = Date.now();
      if (now - prev.lastActivityAt < ACTIVITY_THROTTLE_MS) return prev;
      return { ...prev, lastActivityAt: now };
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (!res.ok) {
        setState((prev) => ({ ...prev, authenticated: false, userId: null, username: null }));
        return;
      }
      const data = (await res.json()) as { user?: { id: string; username: string; role_level: number } };
      if (data.user) {
        setState((prev) => ({
          ...prev,
          userId: data.user!.id,
          username: data.user!.username,
          roleLevel: data.user!.role_level ?? 0,
          authenticated: true,
          lastActivityAt: Date.now(),
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    }
    setState((prev) => ({
      ...prev,
      userId: null,
      username: null,
      roleLevel: 0,
      authenticated: false,
      expiresAt: null,
    }));
  }, []);

  const extend = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { method: "PATCH", cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { expiresAt?: number };
        setState((prev) => ({
          ...prev,
          expiresAt: data.expiresAt ?? Date.now() + SESSION_TIMEOUT_MS,
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    const handler = () => recordActivity();
    for (const ev of events) {
      window.addEventListener(ev, handler, { passive: true });
    }
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, handler);
      }
    };
  }, [recordActivity]);

  useEffect(() => {
    if (!state.authenticated) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const inactive = now - state.lastActivityAt;
      if (inactive > SESSION_TIMEOUT_MS) {
        logout();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state.authenticated, state.lastActivityAt, logout]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      refresh,
      logout,
      extend,
      recordActivity,
    }),
    [state, refresh, logout, extend, recordActivity]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    return {
      userId: null,
      username: null,
      roleLevel: 0,
      authenticated: false,
      expiresAt: null,
      lastActivityAt: Date.now(),
      refresh: async () => {},
      logout: async () => {},
      extend: async () => {},
      recordActivity: () => {},
    };
  }
  return ctx;
}

export function useAuthenticated(): boolean {
  const { authenticated } = useSession();
  return authenticated;
}

export function useRoleLevel(): number {
  const { roleLevel } = useSession();
  return roleLevel;
}
