import "server-only";

export type GameType = "Roulette" | "Dice" | "Slots5x3" | "Slots5x5" | "Slots10x10";

export interface GameResult {
  game: GameType;
  wager: number;
  multiplier: number;
  profit: number;
  outcome: string;
  balanceAfter: number;
  timestamp: number;
  nonce: number;
  metadata?: Record<string, unknown>;
}

export interface GameEngineConfig {
  houseEdge: number;
  minWager: number;
  maxWager: number;
  payoutScale: number;
}

export interface RNG {
  float: (seed?: number) => number;
  int: (min: number, max: number, seed?: number) => number;
  bool: (probability: number, seed?: number) => boolean;
  pick: <T>(arr: T[], seed?: number) => T;
}

function mulberry32(seed: number): RNG {
  let state = seed >>> 0;
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t >>> 7, 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float: (s?: number) => {
      if (s != null) state = s >>> 0;
      return next();
    },
    int: (min: number, max: number, s?: number) => {
      if (s != null) state = s >>> 0;
      return Math.floor(min + next() * (max - min + 1));
    },
    bool: (probability: number, s?: number) => {
      if (s != null) state = s >>> 0;
      return next() < probability;
    },
    pick: <T>(arr: T[], s?: number): T => {
      if (s != null) state = s >>> 0;
      const idx = Math.floor(next() * arr.length);
      return arr[idx]!;
    },
  };
}

export function createRNG(seed: number): RNG {
  return mulberry32(seed);
}

export abstract class GameEngine<Input = unknown, State = unknown> {
  abstract readonly gameType: GameType;
  abstract readonly config: GameEngineConfig;

  abstract validateInput(input: Input): string | null;
  abstract calculateOutcome(input: Input, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata?: Record<string, unknown>;
  };

  createResult(
    input: Input,
    wager: number,
    balanceBefore: number,
    nonce: number,
    seed: number
  ): GameResult {
    const rng = createRNG(seed);
    const { multiplier, outcome, metadata } = this.calculateOutcome(input, rng);
    const profit = wager * multiplier - wager;
    const balanceAfter = balanceBefore + profit;

    return {
      game: this.gameType,
      wager,
      multiplier,
      profit,
      outcome,
      balanceAfter,
      timestamp: Date.now(),
      nonce,
      metadata,
    };
  }

  validateWager(wager: number): string | null {
    if (!Number.isFinite(wager)) return "Invalid wager.";
    if (wager < this.config.minWager) return `Minimum wager is ${this.config.minWager}.`;
    if (wager > this.config.maxWager) return `Maximum wager is ${this.config.maxWager}.`;
    return null;
  }
}
