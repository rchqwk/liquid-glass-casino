"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { randomHex, rngFloat, rngInt, sha256Hex } from "./provablyFair";
import { useAuth } from "./authClient";

type HistoryItem = {
  ts: number;
  game: string;
  wager: number;
  multiplier: number;
  profit: number;
  outcome: string;
};

type WalletState = {
  balance: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  history: HistoryItem[];
  lastRefill5000At?: number;
  lastRefill100At?: number;
  openBets?: Record<
    number,
    { game: string; wager: number; ts: number; serverSeed: string; clientSeed: string; baseWager?: number }
  >;
  updatedAt?: number;
};

type BetRng = {
  float: (index: number) => number;
  int: (index: number, maxExclusive: number) => number;
  nonce: number;
};

type PlaceBetInput = {
  game: string;
  wager: number;
  // Optional display denominator for multiplier readouts (e.g. bonus-buy games where
  // the cost is 100× base bet, but you want to show X based on the base bet).
  baseWager?: number;
  resolve: (rng: BetRng) => { multiplier: number; outcome: string };
};

type WalletContextValue = {
  balance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  history: HistoryItem[];
  setBalance: (balance: number) => void;
  getRngForNonce: (nonce: number) => BetRng | null;
  refill5000AvailableAt: number; // epoch ms
  refill100AvailableAt: number; // epoch ms
  deposit: (
    amount: number,
    opts?: { bypassCooldown?: boolean; refill5000?: boolean; refill100?: boolean },
  ) => Promise<{ ok: true; nextAvailableAt?: number } | { ok: false; error: string; nextAvailableAt?: number }>;
  setClientSeed: (seed: string) => void;
  rotateServerSeed: () => { revealedServerSeed: string };
  placeBet: (input: PlaceBetInput) => { multiplier: number; outcome: string; profit: number; balanceAfter: number };
  beginBet: (input: {
    game: string;
    wager: number;
    baseWager?: number;
  }) => { nonce: number; rng: BetRng } | { error: string };
  settleBet: (input: {
    nonce: number;
    multiplier: number;
    outcome: string;
  }) =>
    | { profit: number; multiplier: number; outcome: string; balanceAfter: number }
    | { error: string };
  reserveServerBet: (input: {
    game: string;
    wager: number;
    baseWager?: number;
  }) => Promise<{ nonce: number } | { error: string }>;
  settleServerBet: (input: {
    nonce: number;
    multiplier: number;
    outcome: string;
  }) => Promise<{ profit: number; balanceAfter: number } | { error: string }>;
  cancelServerBet: (input: { nonce: number; outcome?: string }) => Promise<{ balanceAfter: number } | { error: string }>;
  adjustServerBalance: (input: { delta: number; game?: string; outcome?: string }) => Promise<{ balanceAfter: number } | { error: string }>;
  syncFromServer: () => Promise<void>;
  reset: (opts?: { balance?: number }) => Promise<void>;
};

const STORAGE_KEY = "lgc.wallet.v1";
const REFILL_5000_COOLDOWN_MS = 15 * 60 * 1000;
const REFILL_100_COOLDOWN_MS = 60 * 1000;

function clampMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function loadState(): WalletState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeWalletState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveState(state: WalletState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emitClientEvent(name: string, detail: any) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // ignore
  }
}

function freshState(): WalletState {
  const serverSeed = randomHex(32);
  const clientSeed = randomHex(16);
  return {
    balance: 1000,
    serverSeed,
    serverSeedHash: sha256Hex(serverSeed),
    clientSeed,
    nonce: 0,
    history: [],
    lastRefill5000At: 0,
    lastRefill100At: 0,
    openBets: {},
    updatedAt: Date.now(),
  };
}

function normalizeWalletState(raw: Partial<WalletState> | null | undefined): WalletState {
  const state = raw ?? {};
  const serverSeed = String(state.serverSeed ?? randomHex(32));
  const openBetsRaw = state.openBets && typeof state.openBets === "object" ? state.openBets : {};
  const openBets: WalletState["openBets"] = {};
  for (const [k, v] of Object.entries(openBetsRaw)) {
    const nonce = Number(k);
    if (!Number.isFinite(nonce) || nonce < 0) continue;
    const bet: any = v ?? {};
    openBets[nonce] = {
      game: String(bet.game ?? ""),
      wager: Number(bet.wager ?? 0) || 0,
      ts: Number(bet.ts ?? 0) || 0,
      serverSeed: String(bet.serverSeed ?? ""),
      clientSeed: String(bet.clientSeed ?? ""),
      baseWager: Number.isFinite(Number(bet.baseWager)) ? Number(bet.baseWager) : undefined,
    };
  }
  return {
    balance: Math.max(0, clampMoney(Number(state.balance ?? 1000))),
    serverSeed,
    serverSeedHash: String(state.serverSeedHash ?? "") || sha256Hex(serverSeed),
    clientSeed: String(state.clientSeed ?? randomHex(16)),
    nonce: Math.max(0, Math.floor(Number(state.nonce ?? 0) || 0)),
    history: Array.isArray(state.history) ? state.history.slice(0, 20) : [],
    lastRefill5000At: Math.max(0, Number(state.lastRefill5000At ?? 0) || 0),
    lastRefill100At: Math.max(0, Number(state.lastRefill100At ?? 0) || 0),
    openBets,
    updatedAt: Math.max(0, Number(state.updatedAt ?? Date.now()) || Date.now()),
  };
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<WalletState | null>(null);
  const [serverWalletReadyFor, setServerWalletReadyFor] = useState<number | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded ?? freshState());
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    if (!user?.id) {
      setServerWalletReadyFor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setServerWalletReadyFor(user.id);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { state?: WalletState | null };
        if (cancelled) return;
        if (data.state) {
          setState(normalizeWalletState(data.state));
        } else {
          await fetch("/api/wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "sync", state: normalizeWalletState(state) }),
          });
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setServerWalletReadyFor(user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!state) return;
    if (!user?.id) return;
    if (serverWalletReadyFor !== user.id) return;
    const id = window.setTimeout(() => {
      void fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync", state }),
      }).catch(() => {
        // ignore
      });
    }, 150);
    return () => window.clearTimeout(id);
  }, [state, user?.id, serverWalletReadyFor]);

  const value = useMemo<WalletContextValue>(() => {
    if (!state) {
      // Temporary placeholder (initial render before localStorage loads).
      return {
        balance: 0,
        serverSeedHash: "",
        clientSeed: "",
        nonce: 0,
        history: [],
        setBalance: () => {},
        getRngForNonce: () => null,
        refill5000AvailableAt: 0,
        refill100AvailableAt: 0,
        deposit: async () => ({ ok: false, error: "Wallet not ready" }),
        setClientSeed: () => {},
        rotateServerSeed: () => ({ revealedServerSeed: "" }),
        placeBet: () => ({ multiplier: 0, outcome: "", profit: 0, balanceAfter: 0 }),
        beginBet: () => ({ error: "Wallet not ready" }),
        settleBet: () => ({ error: "Wallet not ready" }),
        reserveServerBet: async () => ({ error: "Wallet not ready" }),
        settleServerBet: async () => ({ error: "Wallet not ready" }),
        cancelServerBet: async () => ({ error: "Wallet not ready" }),
        adjustServerBalance: async () => ({ error: "Wallet not ready" }),
        syncFromServer: async () => {},
        reset: async () => {},
      };
    }

    return {
      balance: state.balance,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
      history: state.history,
      setBalance: (bal) => {
        const nextBal = clampMoney(Number(bal ?? 0));
        if (!Number.isFinite(nextBal) || nextBal < 0) return;
        setState((s) => {
          if (!s) return s;
          return { ...s, balance: nextBal, openBets: {}, updatedAt: Date.now() };
        });
      },
      refill5000AvailableAt:
        (state.lastRefill5000At ?? 0) + REFILL_5000_COOLDOWN_MS,
      refill100AvailableAt:
        (state.lastRefill100At ?? 0) + REFILL_100_COOLDOWN_MS,
      getRngForNonce: (betNonce) => {
        const open = state.openBets?.[betNonce];
        if (!open) return null;
        return {
          nonce: betNonce,
          float: (index) =>
            rngFloat({
              serverSeed: open.serverSeed,
              clientSeed: open.clientSeed,
              nonce: betNonce,
              index,
            }),
          int: (index, maxExclusive) =>
            rngInt({
              serverSeed: open.serverSeed,
              clientSeed: open.clientSeed,
              nonce: betNonce,
              index,
              maxExclusive,
            }),
        };
      },

      deposit: async (amount, opts) => {
        if (!Number.isFinite(amount) || amount <= 0) {
          return { ok: false, error: "Invalid amount" };
        }

        const bypass = !!opts?.bypassCooldown;
        const isRefill5000 = !!opts?.refill5000 || amount === 5000;
        const isRefill100 = !!opts?.refill100 || amount === 100;
        const now = Date.now();

        if (user?.id) {
          try {
            const res = await fetch("/api/wallet", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "claim_refill",
                kind: isRefill5000 ? "refill5000" : "refill100",
                delta: amount,
                bypassCooldown: bypass,
              }),
            });
            const data = (await res.json().catch(() => ({}))) as any;
            if (!res.ok) {
              return {
                ok: false,
                error: String(data?.error ?? "Refill failed"),
                nextAvailableAt: Number(data?.nextAvailableAt ?? 0) || undefined,
              };
            }
            if (data?.state) setState(normalizeWalletState(data.state));
            return { ok: true, nextAvailableAt: Number(data?.nextAvailableAt ?? 0) || undefined };
          } catch {
            return { ok: false, error: "Refill failed" };
          }
        }

        if (isRefill5000 && !bypass) {
          const nextAt = (state.lastRefill5000At ?? 0) + REFILL_5000_COOLDOWN_MS;
          if (now < nextAt) {
            return {
              ok: false,
              error: "Refill is on cooldown.",
              nextAvailableAt: nextAt,
            };
          }
        }

        if (isRefill100 && !bypass) {
          const nextAt = (state.lastRefill100At ?? 0) + REFILL_100_COOLDOWN_MS;
          if (now < nextAt) {
            return {
              ok: false,
              error: "Refill is on cooldown.",
              nextAvailableAt: nextAt,
            };
          }
        }

        setState((s) => {
          if (!s) return s;
          return {
            ...s,
            balance: clampMoney(s.balance + amount),
            lastRefill5000At:
              isRefill5000 && !bypass ? now : s.lastRefill5000At,
            lastRefill100At:
              isRefill100 && !bypass ? now : s.lastRefill100At,
            updatedAt: now,
          };
        });
        return { ok: true };
      },

      setClientSeed: (seed) => {
        const next = seed.trim();
        if (!next) return;
        setState((s) => (s ? { ...s, clientSeed: next, updatedAt: Date.now() } : s));
      },

      rotateServerSeed: () => {
        const revealed = state.serverSeed;
        const nextServerSeed = randomHex(32);
        setState((s) =>
          s
            ? {
                ...s,
                serverSeed: nextServerSeed,
                serverSeedHash: sha256Hex(nextServerSeed),
                nonce: 0,
                openBets: {},
                updatedAt: Date.now(),
              }
            : s,
        );
        return { revealedServerSeed: revealed };
      },

      placeBet: ({ game, wager, baseWager, resolve }) => {
        emitClientEvent("lgc:betstart", { game, wager: clampMoney(wager), ts: Date.now() });
        if (!Number.isFinite(wager) || wager <= 0) {
          return { multiplier: 0, outcome: "Invalid wager", profit: 0, balanceAfter: state.balance };
        }

        const current = state;
        if (current.balance < wager) {
          return { multiplier: 0, outcome: "Insufficient balance", profit: 0, balanceAfter: current.balance };
        }

        const betNonce = current.nonce;
        const rng: BetRng = {
          nonce: betNonce,
          float: (index) =>
            rngFloat({
              serverSeed: current.serverSeed,
              clientSeed: current.clientSeed,
              nonce: betNonce,
              index,
            }),
          int: (index, maxExclusive) =>
            rngInt({
              serverSeed: current.serverSeed,
              clientSeed: current.clientSeed,
              nonce: betNonce,
              index,
              maxExclusive,
            }),
        };

        const res = resolve(rng);
        const multiplier = Math.max(0, Number(res.multiplier) || 0);
        const payout = wager * multiplier;
        const nextBalance = clampMoney(current.balance - wager + payout);
        const profit = clampMoney(payout - wager);
        const denom = Number(baseWager);
        const denomWager = Number.isFinite(denom) && denom > 0 ? denom : wager;
        const returnMult = denomWager > 0 ? payout / denomWager : 0;

        setState((s) =>
          s
            ? {
                ...s,
                balance: nextBalance,
                nonce: s.nonce + 1,
                history: [
                  {
                    ts: Date.now(),
                    game,
                    wager: clampMoney(wager),
                    multiplier,
                    profit,
                    outcome: res.outcome,
                  },
                  ...s.history,
                ].slice(0, 20),
                updatedAt: Date.now(),
              }
            : s,
        );

        if (returnMult >= 20) {
          emitClientEvent("lgc:bigwin", {
            game,
            wager: clampMoney(wager),
            profit,
            returnMult,
            ts: Date.now(),
          });
        } else {
          emitClientEvent("lgc:betsettled", {
            game,
            wager: clampMoney(wager),
            profit,
            returnMult,
            ts: Date.now(),
          });
        }

        return { multiplier, outcome: res.outcome, profit, balanceAfter: nextBalance };
      },

      beginBet: ({ game, wager, baseWager }) => {
        emitClientEvent("lgc:betstart", { game, wager: clampMoney(wager), ts: Date.now() });
        if (!Number.isFinite(wager) || wager <= 0) return { error: "Invalid wager" };
        const current = state;
        if (current.balance < wager) return { error: "Insufficient balance" };
        const betNonce = current.nonce;

        // IMPORTANT: return RNG immediately from the *current* seeds so callers
        // can use it without waiting for React state updates.
        const rng: BetRng = {
          nonce: betNonce,
          float: (index) =>
            rngFloat({
              serverSeed: current.serverSeed,
              clientSeed: current.clientSeed,
              nonce: betNonce,
              index,
            }),
          int: (index, maxExclusive) =>
            rngInt({
              serverSeed: current.serverSeed,
              clientSeed: current.clientSeed,
              nonce: betNonce,
              index,
              maxExclusive,
            }),
        };

        setState((s) => {
          if (!s) return s;
          const openBets = { ...(s.openBets ?? {}) };
          openBets[betNonce] = {
            game,
            wager: clampMoney(wager),
            ts: Date.now(),
            serverSeed: s.serverSeed,
            clientSeed: s.clientSeed,
            baseWager:
              Number.isFinite(Number(baseWager)) && Number(baseWager) > 0 ? clampMoney(Number(baseWager)) : undefined,
          };
          return {
            ...s,
            balance: clampMoney(s.balance - wager),
            nonce: s.nonce + 1,
            openBets,
            updatedAt: Date.now(),
          };
        });

        return { nonce: betNonce, rng };
      },

      settleBet: ({ nonce: betNonce, multiplier, outcome }) => {
        const open = state.openBets?.[betNonce];
        if (!open) return { error: "Bet not found (already settled?)" };

        const m = Math.max(0, Number(multiplier) || 0);
        const payout = open.wager * m;
        const profit = clampMoney(payout - open.wager);
        const nextBalance = clampMoney(state.balance + payout);
        const denom = Number((open as any).baseWager);
        const denomWager = Number.isFinite(denom) && denom > 0 ? denom : open.wager;
        const returnMult = denomWager > 0 ? payout / denomWager : 0;

        setState((s) => {
          if (!s) return s;
          const ob = { ...(s.openBets ?? {}) };
          delete ob[betNonce];
          return {
            ...s,
            balance: clampMoney(s.balance + payout),
            openBets: ob,
            history: [
              {
                ts: Date.now(),
                game: open.game,
                wager: open.wager,
                multiplier: m,
                profit,
                outcome,
              },
              ...s.history,
            ].slice(0, 20),
            updatedAt: Date.now(),
          };
        });

        if (returnMult >= 20) {
          emitClientEvent("lgc:bigwin", {
            game: open.game,
            wager: clampMoney(open.wager),
            profit,
            returnMult,
            ts: Date.now(),
          });
        } else {
          emitClientEvent("lgc:betsettled", {
            game: open.game,
            wager: clampMoney(open.wager),
            profit,
            returnMult,
            ts: Date.now(),
          });
        }

        return { profit, multiplier: m, outcome, balanceAfter: nextBalance };
      },

      reserveServerBet: async ({ game, wager, baseWager }) => {
        if (!user?.id) {
          const started = (() => {
            emitClientEvent("lgc:betstart", { game, wager: clampMoney(wager), ts: Date.now() });
            if (!Number.isFinite(wager) || wager <= 0) return { error: "Invalid wager" as const };
            const current = state;
            if (current.balance < wager) return { error: "Insufficient balance" as const };
            const betNonce = current.nonce;
            setState((s) => {
              if (!s) return s;
              const openBets = { ...(s.openBets ?? {}) };
              openBets[betNonce] = {
                game,
                wager: clampMoney(wager),
                ts: Date.now(),
                serverSeed: s.serverSeed,
                clientSeed: s.clientSeed,
                baseWager:
                  Number.isFinite(Number(baseWager)) && Number(baseWager) > 0 ? clampMoney(Number(baseWager)) : undefined,
              };
              return {
                ...s,
                balance: clampMoney(s.balance - wager),
                nonce: s.nonce + 1,
                openBets,
                updatedAt: Date.now(),
              };
            });
            return { nonce: betNonce };
          })();
          if ("error" in started) return started;
          return started;
        }
        try {
          const res = await fetch("/api/wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "reserve_bet", game, wager, baseWager }),
          });
          const data = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) return { error: String(data?.error ?? "Failed to reserve bet") };
          if (data?.state) setState(normalizeWalletState(data.state));
          return { nonce: Number(data?.nonce ?? -1) };
        } catch {
          return { error: "Failed to reserve bet" };
        }
      },

      settleServerBet: async ({ nonce: betNonce, multiplier, outcome }) => {
        if (!user?.id) {
          const settled = (() => {
            const open = state.openBets?.[betNonce];
            if (!open) return { error: "Bet not found (already settled?)" as const };
            const m = Math.max(0, Number(multiplier) || 0);
            const payout = open.wager * m;
            const profit = clampMoney(payout - open.wager);
            const nextBalance = clampMoney(state.balance + payout);
            setState((s) => {
              if (!s) return s;
              const ob = { ...(s.openBets ?? {}) };
              delete ob[betNonce];
              return {
                ...s,
                balance: clampMoney(s.balance + payout),
                openBets: ob,
                history: [
                  {
                    ts: Date.now(),
                    game: open.game,
                    wager: open.wager,
                    multiplier: m,
                    profit,
                    outcome,
                  },
                  ...s.history,
                ].slice(0, 20),
                updatedAt: Date.now(),
              };
            });
            return { profit, balanceAfter: nextBalance };
          })();
          if ("error" in settled) return settled;
          return settled;
        }
        try {
          const res = await fetch("/api/wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "settle_bet", nonce: betNonce, multiplier, outcome }),
          });
          const data = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) return { error: String(data?.error ?? "Failed to settle bet") };
          if (data?.state) setState(normalizeWalletState(data.state));
          return {
            profit: clampMoney(Number(data?.profit ?? 0) || 0),
            balanceAfter: clampMoney(Number(data?.balanceAfter ?? 0) || 0),
          };
        } catch {
          return { error: "Failed to settle bet" };
        }
      },

      cancelServerBet: async ({ nonce: betNonce, outcome }) => {
        if (!user?.id) {
          const settled = await (async () => {
            return await Promise.resolve(
              (() => {
                const open = state.openBets?.[betNonce];
                if (!open) return { error: "Bet not found (already settled?)" as const };
                const payout = open.wager;
                const nextBalance = clampMoney(state.balance + payout);
                setState((s) => {
                  if (!s) return s;
                  const ob = { ...(s.openBets ?? {}) };
                  delete ob[betNonce];
                  return {
                    ...s,
                    balance: clampMoney(s.balance + payout),
                    openBets: ob,
                    history: [
                      {
                        ts: Date.now(),
                        game: open.game,
                        wager: open.wager,
                        multiplier: 1,
                        profit: 0,
                        outcome: outcome ?? "Bet canceled",
                      },
                      ...s.history,
                    ].slice(0, 20),
                    updatedAt: Date.now(),
                  };
                });
                return { balanceAfter: nextBalance };
              })(),
            );
          })();
          if ("error" in settled) return settled;
          return settled;
        }
        try {
          const res = await fetch("/api/wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "cancel_bet", nonce: betNonce, outcome: outcome ?? "Bet canceled" }),
          });
          const data = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) return { error: String(data?.error ?? "Failed to cancel bet") };
          if (data?.state) setState(normalizeWalletState(data.state));
          return { balanceAfter: clampMoney(Number(data?.balanceAfter ?? 0) || 0) };
        } catch {
          return { error: "Failed to cancel bet" };
        }
      },

      adjustServerBalance: async ({ delta, game, outcome }) => {
        if (!user?.id) {
          const nextBalance = clampMoney(state.balance + delta);
          if (nextBalance < 0) return { error: "Insufficient balance" };
          setState((s) => (s ? { ...s, balance: nextBalance, updatedAt: Date.now() } : s));
          return { balanceAfter: nextBalance };
        }
        try {
          const res = await fetch("/api/wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "adjust_balance", delta, game, outcome }),
          });
          const data = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) return { error: String(data?.error ?? "Failed to adjust balance") };
          if (data?.state) setState(normalizeWalletState(data.state));
          return { balanceAfter: clampMoney(Number(data?.balanceAfter ?? 0) || 0) };
        } catch {
          return { error: "Failed to adjust balance" };
        }
      },

      syncFromServer: async () => {
        if (!user?.id) return;
        try {
          const res = await fetch("/api/wallet", { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json().catch(() => ({}))) as { state?: WalletState | null };
          if (data.state) setState(normalizeWalletState(data.state));
        } catch {
          // ignore
        }
      },

      reset: async (opts) => {
        if (user?.id) {
          try {
            const res = await fetch("/api/wallet", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "reset_wallet", balance: Number(opts?.balance ?? 1000) }),
            });
            const data = (await res.json().catch(() => ({}))) as any;
            if (res.ok && data?.state) {
              setState(normalizeWalletState(data.state));
              return;
            }
          } catch {
            // ignore
          }
        }
        const next = freshState();
        if (typeof opts?.balance === "number") next.balance = clampMoney(Math.max(0, Number(opts.balance) || 0));
        next.updatedAt = Date.now();
        setState(next);
      },
    };
  }, [state, user?.id]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
