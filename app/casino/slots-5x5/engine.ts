"use client";

export type SymbolId =
  | "cherry"
  | "lemon"
  | "bell"
  | "star"
  | "seven"
  | "bar"
  | "diamond" // wild
  | "coin"; // scatter

export const WILD: SymbolId = "diamond";
export const SCATTER: SymbolId = "coin";

export type SpinMode = "base" | "freespin";

export type WaysWinInfo = {
  symbol: Exclude<SymbolId, typeof SCATTER>;
  len: number; // 3..5
  ways: number;
  pay: number;
  matched: boolean[][]; // [reel][row]
};

export type SpinResult = {
  grid: SymbolId[][]; // [reel][row] => 5x5
  scatterCount: number;
  winMultiplier: number; // win multiplier (profit / wager)
  triggeredFreeSpins: boolean;
  waysBest: WaysWinInfo | null;
};

// Global RTP tuning for the 5x5 game.
// Lower this to reduce overall returns.
const RTP_MULT = 0.1;

const SYMBOLS: { s: SymbolId; w: number }[] = [
  // ~50% more "cheap" symbols (cherry/lemon/bar) to reduce win volatility.
  { s: "cherry", w: 45 },
  { s: "lemon", w: 45 },
  { s: "bar", w: 40 },
  // slightly reduce premium/specials
  { s: "bell", w: 10 },
  { s: "star", w: 6 },
  { s: "seven", w: 4 },
  { s: "diamond", w: 1.2 }, // wild
  { s: "coin", w: 0.9 }, // scatter (lower feature frequency)
];

// base multiplier per way for 3/4/5 in a row (left-to-right)
const PAY_WAYS: Record<Exclude<SymbolId, typeof SCATTER>, [number, number, number]> = {
  cherry: [0.08, 0.25, 0.8],
  lemon: [0.08, 0.25, 0.8],
  bar: [0.1, 0.35, 1.2],
  bell: [0.2, 0.7, 2.5],
  star: [0.35, 1.2, 4.0],
  seven: [0.6, 2.4, 8.0],
  diamond: [0.5, 2.0, 7.0], // wilds pay too
};

function weightedPick(r01: number): SymbolId {
  const total = SYMBOLS.reduce((a, b) => a + b.w, 0);
  let x = r01 * total;
  for (const it of SYMBOLS) {
    x -= it.w;
    if (x <= 0) return it.s;
  }
  return SYMBOLS[0]!.s;
}

function countScatters(grid: SymbolId[][]) {
  let c = 0;
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x]!.length; y++) {
      if (grid[x]![y] === SCATTER) c += 1;
    }
  }
  return c;
}

export function analyzeWaysBest(grid: SymbolId[][]): WaysWinInfo | null {
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (reels < 3 || rows < 1) return null;

  const symbols = Object.keys(PAY_WAYS) as Array<Exclude<SymbolId, typeof SCATTER>>;
  let best: WaysWinInfo | null = null;

  for (const sym of symbols) {
    const counts: number[] = [];
    for (let x = 0; x < reels; x++) {
      let c = 0;
      for (let y = 0; y < rows; y++) {
        const v = grid[x]![y]!;
        if (v === sym || v === WILD) c += 1;
      }
      counts.push(c);
    }
    let len = 0;
    for (let x = 0; x < counts.length; x++) {
      if (counts[x]! <= 0) break;
      len += 1;
    }
    if (len < 3) continue;

    const ways = counts.slice(0, len).reduce((a, b) => a * b, 1);
    const pay = PAY_WAYS[sym][len - 3] * ways;
    if (pay <= 0) continue;

    const matched: boolean[][] = Array.from({ length: reels }, (_, x) =>
      Array.from({ length: rows }, (_, y) => {
        if (x >= len) return false;
        const v = grid[x]![y]!;
        return v === sym || v === WILD;
      }),
    );

    if (!best || pay > best.pay) best = { symbol: sym, len, ways, pay, matched };
  }

  return best;
}

export function spinSlots5x5(input: {
  rngFloat: (i: number) => number;
  mode: SpinMode;
  payoutScale: number;
  extraChanceProbability: number;
  lucky?: {
    scatterWeightMultiplier: number; // e.g. 1.25
    ensureMinScatters: number; // e.g. 2
    extraWildChance: number; // e.g. 0.25
  };
}): SpinResult {
  const reels = 5;
  const rows = 5;
  const grid: SymbolId[][] = Array.from({ length: reels }, (_, x) =>
    Array.from({ length: rows }, (_, y) => {
      const picked = weightedPick(input.rngFloat(x * 16 + y));
      const lucky = input.lucky;
      if (lucky && input.mode === "base" && picked !== SCATTER) {
        const boost = Math.max(0, lucky.scatterWeightMultiplier - 1);
        if (boost > 0 && input.rngFloat(8000 + x * 16 + y) < boost * 0.06) return SCATTER;
      }
      return picked;
    }),
  );

  if (input.lucky && input.mode === "base") {
    // ensure minimum scatters (near-miss juice)
    let scatters = countScatters(grid);
    let idx = 9000;
    while (scatters < input.lucky.ensureMinScatters) {
      const x = Math.floor(input.rngFloat(idx++) * reels);
      const y = Math.floor(input.rngFloat(idx++) * rows);
      if (grid[x]![y] !== SCATTER) {
        grid[x]![y] = SCATTER;
        scatters += 1;
      }
    }
    // extra wild chance
    if (input.rngFloat(9999) < input.lucky.extraWildChance) {
      const x = Math.floor(input.rngFloat(10000) * reels);
      const y = Math.floor(input.rngFloat(10001) * rows);
      if (grid[x]![y] !== SCATTER) grid[x]![y] = WILD;
    }
  }

  const scatterCount = countScatters(grid);
  let triggeredFreeSpins = scatterCount >= 3;

  if (!triggeredFreeSpins && scatterCount === 2) {
    if (input.rngFloat(999) < input.extraChanceProbability) triggeredFreeSpins = true;
  }

  const best = analyzeWaysBest(grid);
  const scale = Math.min(10, Math.max(0.1, input.payoutScale || 1));
  const winMultiplier = (best?.pay ?? 0) * scale * RTP_MULT;

  return { grid, scatterCount, winMultiplier, triggeredFreeSpins, waysBest: best };
}
