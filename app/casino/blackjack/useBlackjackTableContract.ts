"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useBlackjackTableContract<TState>(tableId: string | null, refreshKey?: unknown) {
  const [state, setState] = useState<TState | null>(null);
  const [tableMeta, setTableMeta] = useState<BlackjackTableMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const applyTablePayload = useCallback((payload: BlackjackTablePayload<TState> | null | undefined) => {
    if (payload?.state) setState(payload.state);
    if (payload?.meta) setTableMeta(payload.meta);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!tableId) {
          setErr("Invalid table id");
          setState(null);
          setTableMeta(null);
          return;
        }
        const res = await fetch(`/api/blackjack/tables/${tableId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as BlackjackTablePayload<TState>;
        if (cancelled) return;
        if (!res.ok) {
          setErr(data?.error ?? "Failed to load table");
          setState(null);
          setTableMeta(null);
          return;
        }
        setErr(null);
        applyTablePayload(data);
      } catch {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId, refreshKey, applyTablePayload]);

  const requestTableRoute = useCallback(
    async (path: string, body?: any, fallbackError = "Action failed") => {
      setErr(null);
      if (!tableId) {
        setErr("Invalid table id");
        return { ok: false as const };
      }
      const res = await fetch(`/api/blackjack/tables/${tableId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await res.json().catch(() => ({}))) as BlackjackTablePayload<TState>;
      if (!res.ok) setErr(data?.error ?? fallbackError);
      if (data?.state) applyTablePayload(data);
      return { ok: !!res.ok, data };
    },
    [tableId, applyTablePayload],
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
  };
}
