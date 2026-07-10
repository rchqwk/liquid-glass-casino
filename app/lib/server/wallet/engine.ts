import "server-only";
import { randomBytes } from "node:crypto";
import { walletsRepo, leaderboardRepo, type PersistedWalletState } from "../db";
import { WALLET } from "../../shared/constants";
import { createServerSeed, hashServerSeed } from "../../shared/rng";

export function freshWalletState(): PersistedWalletState {
  const serverSeed = createServerSeed();
  return {
    balance: WALLET.STARTING_BALANCE,
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed: randomBytes(8).toString("hex"),
    nonce: 0,
    history: [],
    lastRefill5000At: 0,
    lastRefill100At: 0,
    openBets: {},
    updatedAt: Date.now(),
  };
}

export function normalizeWalletState(raw: PersistedWalletState | null): PersistedWalletState {
  if (!raw) return freshWalletState();
  return {
    ...freshWalletState(),
    ...raw,
    openBets: raw.openBets ?? {},
    history: raw.history ?? [],
  };
}

export async function getWallet(userId: number): Promise<PersistedWalletState> {
  const raw = await walletsRepo.getState(userId);
  return normalizeWalletState(raw);
}

export async function saveWallet(userId: number, state: PersistedWalletState): Promise<void> {
  await walletsRepo.saveState(userId, state);
}

function nextBetId(state: PersistedWalletState): number {
  const explicit = (state as PersistedWalletState & { nextBetId?: number }).nextBetId;
  const fromKeys = Object.keys(state.openBets ?? {})
    .map(Number)
    .reduce((max, k) => Math.max(max, k), 0);
  const id = (explicit ?? fromKeys) + 1;
  (state as PersistedWalletState & { nextBetId?: number }).nextBetId = id;
  return id;
}

export type ReservedBet = {
  betId: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

export async function reserveBet(
  userId: number,
  opts: { game: string; wager: number; clientSeed?: string | null }
): Promise<{ state: PersistedWalletState; reserved: ReservedBet }> {
  const state = await getWallet(userId);
  if (!Number.isFinite(opts.wager) || opts.wager <= 0) {
    throw new Error("Invalid wager.");
  }
  if (state.balance < opts.wager) {
    throw new Error("Insufficient balance.");
  }
  state.balance = Math.round((state.balance - opts.wager) * 100) / 100;
  state.nonce += 1;
  const clientSeed = opts.clientSeed ?? state.clientSeed;
  const serverSeed = createServerSeed();
  const betId = nextBetId(state);
  state.openBets = state.openBets ?? {};
  state.openBets[betId] = {
    game: opts.game,
    wager: opts.wager,
    ts: Date.now(),
    serverSeed,
    clientSeed,
    baseWager: opts.wager,
  };
  await saveWallet(userId, state);
  return {
    state,
    reserved: {
      betId,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed,
      nonce: state.nonce,
    },
  };
}

export type SettleResult = {
  state: PersistedWalletState;
  balance: number;
  profit: number;
  wager: number;
  payout: number;
  isBigWin: boolean;
  revealedServerSeed: string;
};

export async function settleBet(
  userId: number,
  betId: number,
  result: { payout: number; outcome: "win" | "loss" | "push"; multiplier: number }
): Promise<SettleResult> {
  const state = await getWallet(userId);
  const open = (state.openBets ?? {})[betId];
  if (!open) throw new Error("Bet not found or already settled.");
  const wager = open.baseWager ?? open.wager;
  const payout = Math.max(0, Math.round(result.payout * 100) / 100);
  const profit = Math.round((payout - wager) * 100) / 100;
  state.balance = Math.round((state.balance + payout) * 100) / 100;
  state.history.unshift({
    ts: Date.now(),
    game: open.game,
    wager,
    multiplier: result.multiplier,
    profit,
    outcome: result.outcome,
  });
  state.history = state.history.slice(0, 100);
  state.openBets = state.openBets ?? {};
  delete state.openBets[betId];
  const isBigWin = wager > 0 && payout / wager >= WALLET.BIG_WIN_MULTIPLE;
  await saveWallet(userId, state);
  await leaderboardRepo.record(userId, profit, wager);
  return {
    state,
    balance: state.balance,
    profit,
    wager,
    payout,
    isBigWin,
    revealedServerSeed: open.serverSeed,
  };
}

export async function cancelBet(userId: number, betId: number): Promise<PersistedWalletState> {
  const state = await getWallet(userId);
  const open = (state.openBets ?? {})[betId];
  if (!open) return state;
  state.balance = Math.round((state.balance + (open.baseWager ?? open.wager)) * 100) / 100;
  state.openBets = state.openBets ?? {};
  delete state.openBets[betId];
  await saveWallet(userId, state);
  return state;
}

export type RefillTier = "quick" | "large";

export async function refill(
  userId: number,
  tier: RefillTier
): Promise<{ state: PersistedWalletState; refilled: boolean; retryAfterMs: number }> {
  const state = await getWallet(userId);
  const now = Date.now();
  if (tier === "large") {
    const elapsed = now - (state.lastRefill5000At ?? 0);
    if (elapsed < WALLET.LARGE_REFILL_COOLDOWN_MS) {
      return { state, refilled: false, retryAfterMs: WALLET.LARGE_REFILL_COOLDOWN_MS - elapsed };
    }
    state.balance += WALLET.LARGE_REFILL;
    state.lastRefill5000At = now;
  } else {
    const elapsed = now - (state.lastRefill100At ?? 0);
    if (elapsed < WALLET.REFILL_COOLDOWN_MS) {
      return { state, refilled: false, retryAfterMs: WALLET.REFILL_COOLDOWN_MS - elapsed };
    }
    state.balance += WALLET.QUICK_REFILL;
    state.lastRefill100At = now;
  }
  await saveWallet(userId, state);
  return { state, refilled: true, retryAfterMs: 0 };
}
