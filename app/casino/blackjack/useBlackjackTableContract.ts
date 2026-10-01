"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BJState } from "./blackjackTableTypes";

export type BlackjackTableMeta = {
  tableId: string;
  name: string;
  public: boolean;
  phase: string;
  round: number;
  seatCount: number;
  spectatorCount: number;
  meSeatIndex: number;
  isSeated: boolean;
  isSpectator: boolean;
  canChat: boolean;
  currentTurnSeatIndex: number | null;
  currentTurnUserId: number | null;
  bettingEndsAt: number;
  turnEndsAt: number;
  dealerWindowEndsAt: number;
  updatedAt: number;
  lastActivityAt: number;
};

export type BlackjackTablePayload<TState = BJState> = {
  state?: TState;
  meta?: BlackjackTableMeta;
  error?: string;
  tableId?: string;
  ok?: boolean;
  redeemedAmount?: number;
};

export function getBlackjackTableIdFromPayload<TState>(payload: BlackjackTablePayload<TState> | null | undefined) {
  return String(payload?.meta?.tableId ?? payload?.tableId ?? "").trim();
}

export function useBlackjackTableContract<TState>(tableId: string | null, refreshKey?: unknown, actorId?: number) {
  const [state, setState] = useState<TState | null>(null);
  const [tableMeta, setTableMeta] = useState<BlackjackTableMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stateRef = useRef<TState | null>(null);
  const pendingActions=useRef(new Map<string,string>());
  const inFlight = useRef(new Map<string, Promise<{ ok: boolean; data?: BlackjackTablePayload<TState> }>>());
  const [pendingCount, setPendingCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const tableMetaRef = useRef<BlackjackTableMeta | null>(null);

  useEffect(() => {
    stateRef.current = state;
    tableMetaRef.current = tableMeta;
  }, [state, tableMeta]);

  const applyTablePayload = useCallback((payload: BlackjackTablePayload<TState> | null | undefined) => {
    if (payload?.state) setState(payload.state);
    if (payload?.meta) setTableMeta(payload.meta);
  }, []);

  const fetchTable = useCallback(async () => {
    if (!tableId) {
      setConnected(false);
      setErr("Invalid table id");
      setState(null);
      setTableMeta(null);
      return false;
    }
    try {
      const res = await fetch(`/api/blackjack/tables/${tableId}`, { cache: "no-store" });
      const data = (await res.json()) as BlackjackTablePayload<TState>;
      if (!res.ok) {
        setConnected(false);
        const message = data?.error ?? "Failed to load table";
        const shouldPreserveStale = res.status >= 500 || res.status === 429;
        setErr(shouldPreserveStale ? "Temporary server issue. Reconnecting…" : message);
        if (!shouldPreserveStale) {
          setState(null);
          setTableMeta(null);
        }
        return false;
      }
      if (!data.state || data.meta?.tableId !== tableId) throw new Error("Incomplete table response");
      setErr(null);
      setConnected(true);
      applyTablePayload(data);
      return true;
    } catch {
      setConnected(false);
      setErr("Temporary server issue. Reconnecting…");
      // Keep stale state visible on transient network/serverless failures.
      if (!stateRef.current && !tableMetaRef.current) {
        setState(null);
        setTableMeta(null);
      }
      return false;
    }
  }, [tableId, applyTablePayload]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let retryCount = 0;

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = (ok: boolean) => {
      if (cancelled) return;
      const visible = typeof document === "undefined" ? true : document.visibilityState === "visible";
      const base = visible ? 2500 : 10000;
      const backoff = ok ? base : Math.min(30000, base * 2 ** Math.min(retryCount, 3));
      clearTimer();
      timer = window.setTimeout(() => {
        void run();
      }, backoff);
    };

    const run = async () => {
      const ok = await fetchTable();
      if (cancelled) return;
      retryCount = ok ? 0 : retryCount + 1;
      scheduleNext(ok);
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        retryCount = 0;
        clearTimer();
        void run();
      }
    };

    void run();
    try {
      document.addEventListener("visibilitychange", onVisibilityChange);
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      clearTimer();
      try {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      } catch {
        // ignore
      }
    };
  }, [tableId, fetchTable]);

  useEffect(() => {
    if (refreshKey === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh an externally requested table contract, including its missing-ID state.
    void fetchTable();
  }, [refreshKey, fetchTable]);

  const requestTableRoute = useCallback(
    async (path: string, body?: unknown, fallbackError = "Action failed") => {
      setErr(null);
      setActionError(null);
      if (!tableId) {
        setErr("Invalid table id");
        return { ok: false as const };
      }
      const payload=body ? JSON.stringify(body) : "{}";
      const signature=`${actorId ?? "guest"}:${tableId}:${path}:${payload}`;
      const existing = inFlight.current.get(signature);
      if (existing) return existing;
      setPendingCount(count => count + 1);
      const operation = (async () => {
      let storageKey: string | null = null;
      try {
        // Persist only a request ID under a digest, never passwords or action payloads.
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
        storageKey = "lgc.pendingAction." + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        let requestId = pendingActions.current.get(signature);
        try { requestId ||= sessionStorage.getItem(storageKey) || undefined; } catch { /* memory retry remains available */ }
        requestId ||= crypto.randomUUID();
        pendingActions.current.set(signature, requestId);
        try { sessionStorage.setItem(storageKey, requestId); } catch { /* optional storage */ }
        const res = await fetch(`/api/blackjack/tables/${tableId}/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "Idempotency-Key": requestId },
          body: payload,
        });
        const data = (await res.json()) as BlackjackTablePayload<TState>;
        if (res.ok && (!data.state || data.meta?.tableId !== tableId)) throw new Error("Incomplete action acknowledgement");
        if(res.status<500 && res.status!==409 && res.status!==429) {
          pendingActions.current.delete(signature);
          try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
        }
        if (!res.ok) setActionError(data?.error ?? fallbackError);
        if (data?.state) applyTablePayload(data);
        return { ok: !!res.ok, data };
      } catch {
        setActionError("Action not confirmed. Retry the same action to reconcile it safely.");
        return { ok: false as const, data: {} as BlackjackTablePayload<TState> };
      } finally { setPendingCount(count => Math.max(0, count - 1)); inFlight.current.delete(signature); }
      })();
      inFlight.current.set(signature, operation);
      return operation;
    },
    [tableId, actorId, applyTablePayload],
  );

  return {
    state,
    setState,
    tableMeta,
    setTableMeta,
    err,
    setErr,
    applyTablePayload,
    requestTableRoute,
    pendingCount,
    connected,
    fetchTable,
    actionError,
  };
}
