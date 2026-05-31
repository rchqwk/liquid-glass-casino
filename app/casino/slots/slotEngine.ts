"use client";

export type SymbolKey =
  | "🍒"
  | "🍋"
  | "🍇"
  | "🍉"
  | "⭐"
  | "🔔"
  | "💎" // wild
  | "👑"
  | "7"
  | "🪙"; // scatter

export const WILD: SymbolKey = "💎";
export const SCATTER: SymbolKey = "🪙";

export type SpinMode = "base" | "freespin";

export type SpinResult = {
  grid: SymbolKey[][]; // [reel][row]
  scatterCount: number;
  winMultiplier: number; // profit multiplier (not including "stake back")
  outcome: string;
  triggeredFreeSpins: boolean;
  extraChanceTriggered: boolean;
  expandedWildReels: number[];
};

const SYMBOLS: { s: SymbolKey; w: number }[] = [
  { s: "🍒", w: 22 },
  { s: "🍋", w: 22 },
  { s: "🍇", w: 18 },
  { s: "🍉", w: 16 },
  { s: "⭐", w: 10 },
  { s: "🔔", w: 8 },
  { s: "💎", w: 5 },
  { s: "👑", w: 4 },
  { s: "🪙", w: 3 },
  { s: "7", w: 2 },
];

// Ways paytable: multiplier per "way" for 3/4/5 of a kind (left-to-right)
const PAY_WAYS: Record<Exclude<SymbolKey, typeof SCATTER>, [number, number, number]> = {
  "🍒": [0.3, 1.0, 3.0],
  "🍋": [0.3, 1.0, 3.0],
  "🍇": [0.4, 1.4, 4.0],
  "🍉": [0.5, 1.8, 5.0],
  "⭐": [0.7, 2.5, 7.0],
  "🔔": [1.0, 3.5, 10.0],
  "💎": [1.4, 5.0, 14.0], // wilds
  "👑": [2.0, 7.0, 20.0],
  "7": [3.0, 12.0, 35.0],
};

function weightedPick(r01: number): SymbolKey {
  const total = SYMBOLS.reduce((a, b) => a + b.w, 0);
  let x = r01 * total;
  for (const it of SYMBOLS) {
    x -= it.w;
    if (x <= 0) return it.s;
  }
  return SYMBOLS[0]!.s;
}

function countScatters(grid: SymbolKey[][]) {
  let c = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let y = 0; y < grid[r]!.length; y++) {
      if (grid[r]![y] === SCATTER) c += 1;
    }
  }
  return c;
}

function expandWilds(grid: SymbolKey[][]) {
  const expanded: number[] = [];
  const out = grid.map((col) => [...col]);
  for (let x = 0; x < out.length; x++) {
    if (out[x]!.some((s) => s === WILD)) {
      expanded.push(x);
      out[x] = out[x]!.map(() => WILD);
    }
  }
  return { grid: out, expandedWildReels: expanded };
}

function waysPayout(grid: SymbolKey[][]) {
  // 5 reels, 3 rows. Pay left-to-right, 3+ matching reels.
  // For each symbol, count matches per reel (symbol or wild); ways = product.
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (reels < 3 || rows < 1) return { winMultiplier: 0, detail: "LOSE" };

  const symbols = Object.keys(PAY_WAYS) as Array<Exclude<SymbolKey, typeof SCATTER>>;
  let total = 0;
  const wins: string[] = [];

  for (const sym of symbols) {
    // per reel count
    const counts: number[] = [];
    for (let x = 0; x < reels; x++) {
      let c = 0;
      for (let y = 0; y < rows; y++) {
        const v = grid[x]![y]!;
        if (v === sym || v === WILD) c += 1;
      }
      counts.push(c);
    }

    // consecutive from left
    let len = 0;
    for (let x = 0; x < counts.length; x++) {
      if (counts[x]! <= 0) break;
      len += 1;
    }
    if (len < 3) continue;

    const ways = counts.slice(0, len).reduce((a, b) => a * b, 1);
    const pay = PAY_WAYS[sym][len - 3] * ways;
    if (pay > 0) {
      total += pay;
      wins.push(`${sym}×${len} (${ways} ways)`);
    }
  }

  const detail = wins.length ? `WIN ${wins.slice(0, 3).join(", ")}${wins.length > 3 ? "…" : ""}` : "LOSE";
  return { winMultiplier: total, detail };
}

export function spinSlots243Ways(input: {
  rngFloat: (i: number) => number;
  mode: SpinMode;
  payoutScale: number;
  extraChanceProbability: number; // 0..1
}): SpinResult {
  const reels = 5;
  const rows = 3;

  // Build initial grid
  const baseGrid: SymbolKey[][] = Array.from({ length: reels }, (_, x) =>
    Array.from({ length: rows }, (_, y) => weightedPick(input.rngFloat(x * 10 + y))),
  );

  const initialScatter = countScatters(baseGrid);
  let extraChanceTriggered = false;

  // Expand wilds only during free spins (more exciting)
  const expanded = input.mode === "freespin" ? expandWilds(baseGrid) : { grid: baseGrid, expandedWildReels: [] as number[] };

  const { winMultiplier: rawWin, detail } = waysPayout(expanded.grid);
  const scale = Math.min(10, Math.max(0.1, input.payoutScale || 1));
  let winMultiplier = rawWin * scale;

  // Free spins trigger: 3+ scatters. Extra chance: if exactly 2 scatters, small chance to "upgrade" to 3.
  let scatterCount = initialScatter;
  let triggeredFreeSpins = scatterCount >= 3;

  if (!triggeredFreeSpins && scatterCount === 2) {
    const roll = input.rngFloat(999);
    if (roll < input.extraChanceProbability) {
      extraChanceTriggered = true;
      triggeredFreeSpins = true;
      scatterCount = 3;
    }
  }

  const outcomeParts = [
    `Grid ${expanded.grid.map((c) => c.join("")).join(" | ")}`,
    detail,
    scatterCount > 0 ? `${scatterCount} scatters` : null,
    triggeredFreeSpins ? (extraChanceTriggered ? "EXTRA CHANCE FS" : "FREE SPINS") : null,
  ].filter(Boolean);

  return {
    grid: expanded.grid,
    scatterCount,
    winMultiplier,
    outcome: outcomeParts.join(" • "),
    triggeredFreeSpins,
    extraChanceTriggered,
    expandedWildReels: expanded.expandedWildReels,
  };
}

