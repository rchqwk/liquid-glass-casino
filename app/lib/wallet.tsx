"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { randomHex, rngFloat, rngInt, sha256Hex } from "./provablyFair";

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
  openBets?: Record<
    number,
    { game: string; wager: number; ts: number; serverSeed: string; clientSeed: string }
  >;
};

type BetRng = {
  float: (index: number) => number;
  int: (index: number, maxExclusive: number) => number;
  nonce: number;
};

type PlaceBetInput = {
  game: string;
  wager: number;
  resolve: (rng: BetRng) => { multiplier: number; outcome: string };
};

type WalletContextValue = {
  balance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  history: HistoryItem[];
  getRngForNonce: (nonce: number) => BetRng | null;
  deposit: (amount: number) => void;
  setClientSeed: (seed: string) => void;
  rotateServerSeed: () => { revealedServerSeed: string };
  placeBet: (input: PlaceBetInput) => { multiplier: number; outcome: string; profit: number };
  beginBet: (input: {
    game: string;
    wager: number;
  }) => { nonce: number; rng: BetRng } | { error: string };
  settleBet: (input: {
    nonce: number;
    multiplier: number;
    outcome: string;
  }) => { profit: number; multiplier: number; outcome: string } | { error: string };
  reset: () => void;
};

const STORAGE_KEY = "lgc.wallet.v1";

function clampMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function loadState(): WalletState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletState;
  } catch {
    return null;
  }
}

function saveState(state: WalletState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    openBets: {},
  };
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded ?? freshState());
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const value = useMemo<WalletContextValue>(() => {
    if (!state) {
      // Temporary placeholder (initial render before localStorage loads).
      return {
        balance: 0,
        serverSeedHash: "",
        clientSeed: "",
        nonce: 0,
        history: [],
        getRngForNonce: () => null,
        deposit: () => {},
        setClientSeed: () => {},
        rotateServerSeed: () => ({ revealedServerSeed: "" }),
        placeBet: () => ({ multiplier: 0, outcome: "", profit: 0 }),
        beginBet: () => ({ error: "Wallet not ready" }),
        settleBet: () => ({ error: "Wallet not ready" }),
        reset: () => {},
      };
    }

    return {
      balance: state.balance,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
      history: state.history,
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

      deposit: (amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        setState((s) =>
          s ? { ...s, balance: clampMoney(s.balance + amount) } : s,
        );
      },

      setClientSeed: (seed) => {
        const next = seed.trim();
        if (!next) return;
        setState((s) => (s ? { ...s, clientSeed: next } : s));
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
              }
            : s,
        );
        return { revealedServerSeed: revealed };
      },

      placeBet: ({ game, wager, resolve }) => {
        if (!Number.isFinite(wager) || wager <= 0) {
          return { multiplier: 0, outcome: "Invalid wager", profit: 0 };
        }

        const current = state;
        if (current.balance < wager) {
          return { multiplier: 0, outcome: "Insufficient balance", profit: 0 };
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
              }
            : s,
        );

        return { multiplier, outcome: res.outcome, profit };
      },

      beginBet: ({ game, wager }) => {
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
          };
          return {
            ...s,
            balance: clampMoney(s.balance - wager),
            nonce: s.nonce + 1,
            openBets,
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
          };
        });

        return { profit, multiplier: m, outcome };
      },

      reset: () => {
        const next = freshState();
        setState(next);
      },
    };
  }, [state]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
