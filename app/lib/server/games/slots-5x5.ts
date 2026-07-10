import { GameEngine, type RNG } from "./base";

export type SymbolId5x5 =
  | "cherry"
  | "lemon"
  | "bell"
  | "star"
  | "seven"
  | "bar"
  | "diamond"
  | "coin";

export const WILD_5x5: SymbolId5x5 = "diamond";
export const SCATTER_5x5: SymbolId5x5 = "coin";

export type SpinMode5x5 = "base" | "freespin";

export interface WaysWinInfo5x5 {
  symbol: Exclude<SymbolId5x5, typeof SCATTER_5x5>;
  len: number;
  ways: number;
  pay: number;
  matched: boolean[][];
}

export interface Slots5x5Input {
  wager: number;
  mode: SpinMode5x5;
  payoutScale?: number;
  extraChanceProbability?: number;
  lucky?: {
    scatterWeightMultiplier: number;
    ensureMinScatters: number;
    extraWildChance: number;
  };
}

export interface Slots5x5Metadata {
  grid: SymbolId5x5[][];
  scatterCount: number;
  triggeredFreeSpins: boolean;
  waysBest: WaysWinInfo5x5 | null;
  [key: string]: unknown;
}

const RTP_MULT = 0.1;

const SYMBOLS_5x5: { s: SymbolId5x5; w: number }[] = [
  { s: "cherry", w: 45 },
  { s: "lemon", w: 45 },
  { s: "bar", w: 40 },
  { s: "bell", w: 10 },
  { s: "star", w: 6 },
  { s: "seven", w: 4 },
  { s: "diamond", w: 1.2 },
  { s: "coin", w: 0.9 },
];

const PAY_WAYS_5x5: Record<Exclude<SymbolId5x5, typeof SCATTER_5x5>, [number, number, number]> = {
  cherry: [0.08, 0.25, 0.8],
  lemon: [0.08, 0.25, 0.8],
  bar: [0.1, 0.35, 1.2],
  bell: [0.2, 0.7, 2.5],
  star: [0.35, 1.2, 4.0],
  seven: [0.6, 2.4, 8.0],
  diamond: [0.5, 2.0, 7.0],
};

function weightedPick5x5(r01: number): SymbolId5x5 {
  const total = SYMBOLS_5x5.reduce((a, b) => a + b.w, 0);
  let x = r01 * total;
  for (const it of SYMBOLS_5x5) {
    x -= it.w;
    if (x <= 0) return it.s;
  }
  return SYMBOLS_5x5[0]!.s;
}

function countScatters5x5(grid: SymbolId5x5[][]): number {
  let c = 0;
  for (const col of grid) {
    for (const cell of col) {
      if (cell === SCATTER_5x5) c++;
    }
  }
  return c;
}

function analyzeWaysBest5x5(grid: SymbolId5x5[][]): WaysWinInfo5x5 | null {
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (reels < 3 || rows < 1) return null;

  const symbols = Object.keys(PAY_WAYS_5x5) as Array<Exclude<SymbolId5x5, typeof SCATTER_5x5>>;
  let best: WaysWinInfo5x5 | null = null;

  for (const sym of symbols) {
    const counts: number[] = [];
    for (let x = 0; x < reels; x++) {
      let c = 0;
      for (let y = 0; y < rows; y++) {
        const v = grid[x]![y]!;
        if (v === sym || v === WILD_5x5) c++;
      }
      counts.push(c);
    }
    let len = 0;
    for (const count of counts) {
      if (count <= 0) break;
      len++;
    }
    if (len < 3) continue;

    const ways = counts.slice(0, len).reduce((a, b) => a * b, 1);
    const pay = PAY_WAYS_5x5[sym][len - 3] * ways;
    if (pay <= 0) continue;

    const matched: boolean[][] = Array.from({ length: reels }, (_, x) =>
      Array.from({ length: rows }, (_, y) => {
        if (x >= len) return false;
        const v = grid[x]![y]!;
        return v === sym || v === WILD_5x5;
      }),
    );

    if (!best || pay > best.pay) {
      best = { symbol: sym, len, ways, pay, matched };
    }
  }

  return best;
}

function spinSlots5x5Core(rng: RNG, input: Slots5x5Input): {
  grid: SymbolId5x5[][];
  scatterCount: number;
  winMultiplier: number;
  triggeredFreeSpins: boolean;
  waysBest: WaysWinInfo5x5 | null;
} {
  const reels = 5;
  const rows = 5;
  const grid: SymbolId5x5[][] = Array.from({ length: reels }, (_, x) =>
    Array.from({ length: rows }, (_, y) => {
      const picked = weightedPick5x5(rng.float());
      const lucky = input.lucky;
      if (lucky && input.mode === "base" && picked !== SCATTER_5x5) {
        const boost = Math.max(0, lucky.scatterWeightMultiplier - 1);
        if (boost > 0 && rng.float() < boost * 0.06) return SCATTER_5x5;
      }
      return picked;
    }),
  );

  if (input.lucky && input.mode === "base") {
    let scatters = countScatters5x5(grid);
    while (scatters < input.lucky.ensureMinScatters) {
      const x = rng.int(0, reels - 1);
      const y = rng.int(0, rows - 1);
      if (grid[x]![y] !== SCATTER_5x5) {
        grid[x]![y] = SCATTER_5x5;
        scatters++;
      }
    }
    if (rng.float() < input.lucky.extraWildChance) {
      const x = rng.int(0, reels - 1);
      const y = rng.int(0, rows - 1);
      if (grid[x]![y] !== SCATTER_5x5) grid[x]![y] = WILD_5x5;
    }
  }

  const scatterCount = countScatters5x5(grid);
  let triggeredFreeSpins = scatterCount >= 3;
  if (!triggeredFreeSpins && scatterCount === 2) {
    const extraProb = input.extraChanceProbability ?? 0.05;
    if (rng.float() < extraProb) triggeredFreeSpins = true;
  }

  const best = analyzeWaysBest5x5(grid);
  const scale = Math.min(10, Math.max(0.1, input.payoutScale ?? 1));
  const winMultiplier = (best?.pay ?? 0) * scale * RTP_MULT;

  return { grid, scatterCount, winMultiplier, triggeredFreeSpins, waysBest: best };
}

export class Slots5x5Engine extends GameEngine<Slots5x5Input> {
  readonly gameType = "Slots5x5" as const;
  readonly config = {
    houseEdge: 0.04,
    minWager: 0.01,
    maxWager: 10000,
    payoutScale: 1,
  };

  validateInput(input: Slots5x5Input): string | null {
    if (!Number.isFinite(input.wager) || input.wager <= 0) {
      return "Invalid wager.";
    }
    if (!["base", "freespin"].includes(input.mode)) {
      return "Invalid spin mode.";
    }
    return null;
  }

  calculateOutcome(input: Slots5x5Input, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata: Slots5x5Metadata;
  } {
    const result = spinSlots5x5Core(rng, input);
    const outcome = result.triggeredFreeSpins
      ? "FREE SPINS!"
      : result.winMultiplier > 0
        ? `WIN ${result.winMultiplier.toFixed(2)}x`
        : "LOSE";

    return {
      multiplier: result.winMultiplier,
      outcome,
      metadata: {
        grid: result.grid,
        scatterCount: result.scatterCount,
        triggeredFreeSpins: result.triggeredFreeSpins,
        waysBest: result.waysBest,
      },
    };
  }
}

export const slots5x5Engine = new Slots5x5Engine();
