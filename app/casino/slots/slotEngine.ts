"use client";

export type SymbolKey =
  | "🍒"
  | "🍋"
  | "🍇"
  | "🍉"
  | "🍬" // filler (cheap)
  | "🥨" // filler (cheap)
  | "🍀" // filler (cheap)
  | "⭐"
  | "🔔"
  | "💎" // wild
  | "👑"
  | "7"
  | "🪙" // scatter
  | "💰"; // bonus (Hold & Spin)

export const WILD: SymbolKey = "💎";
export const SCATTER: SymbolKey = "🪙";
export const BONUS: SymbolKey = "💰";

export type SpinMode = "base" | "freespin";

export type WaysWinInfo = {
  symbol: Exclude<SymbolKey, typeof SCATTER | typeof BONUS>;
  len: number; // 3..5
  ways: number; // product of matches per reel
  pay: number; // multiplier contribution for this win
  matched: boolean[][]; // [reel][row] true if cell participates (symbol or wild) for reels within len
};

export type SpinResult = {
  grid: SymbolKey[][]; // [reel][row]
  scatterCount: number;
  winMultiplier: number; // profit multiplier (not including "stake back")
  outcome: string;
  triggeredFreeSpins: boolean;
  extraChanceTriggered: boolean;
  expandedWildReels: number[];
  triggeredHoldSpin: boolean;
  holdSpin?: {
    steps: SymbolKey[][][]; // animation frames
    payoutMultiplier: number;
  };
};

const SYMBOLS: { s: SymbolKey; w: number }[] = [
  { s: "🍒", w: 22 },
  { s: "🍋", w: 22 },
  { s: "🍇", w: 18 },
  { s: "🍉", w: 16 },
  // cheap fillers (more common)
  { s: "🍬", w: 24 },
  { s: "🥨", w: 24 },
  { s: "🍀", w: 20 },
  { s: "⭐", w: 10 },
  { s: "🔔", w: 8 },
  // special symbols (reduced frequency)
  { s: "💎", w: 2 },
  { s: "👑", w: 4 },
  { s: "🪙", w: 1.3 },
  { s: "7", w: 2 },
  // Hold & Spin bonus coin (rare)
  { s: "💰", w: 0.8 },
];

// Ways paytable: multiplier per "way" for 3/4/5 of a kind (left-to-right)
const PAY_WAYS: Record<Exclude<SymbolKey, typeof SCATTER | typeof BONUS>, [number, number, number]> = {
  "🍒": [0.3, 1.0, 3.0],
  "🍋": [0.3, 1.0, 3.0],
  "🍇": [0.4, 1.4, 4.0],
  "🍉": [0.5, 1.8, 5.0],
  // cheap fillers pay very small
  "🍬": [0.15, 0.5, 1.6],
  "🥨": [0.15, 0.5, 1.6],
  "🍀": [0.2, 0.7, 2.2],
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

function countBonusCoins(grid: SymbolKey[][]) {
  let c = 0;
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x]!.length; y++) {
      if (grid[x]![y] === BONUS) c += 1;
    }
  }
  return c;
}

function waysPayout(grid: SymbolKey[][]) {
  // 5 reels, 3 rows. Pay left-to-right, 3+ matching reels.
  // For each symbol, count matches per reel (symbol or wild); ways = product.
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (reels < 3 || rows < 1) return { winMultiplier: 0, detail: "LOSE" };

  const symbols = Object.keys(PAY_WAYS) as Array<Exclude<SymbolKey, typeof SCATTER | typeof BONUS>>;
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

export function analyzeWaysWin(grid: SymbolKey[][]): WaysWinInfo | null {
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (reels < 3 || rows < 1) return null;

  const symbols = Object.keys(PAY_WAYS) as Array<Exclude<SymbolKey, typeof SCATTER | typeof BONUS>>;
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

function rotateColumn(col: SymbolKey[], delta: number) {
  const n = col.length;
  if (n <= 1) return col;
  const d = ((delta % n) + n) % n;
  if (d === 0) return col;
  return [...col.slice(n - d), ...col.slice(0, n - d)];
}

function simulateHoldSpin(input: {
  baseGrid: SymbolKey[][];
  rngFloat: (i: number) => number;
  payoutScale: number;
}): { steps: SymbolKey[][][]; payoutMultiplier: number } {
  // Classic Hold&Spin: coins lock, 3 respins; any new coin resets to 3.
  const reels = 5;
  const rows = 3;
  const steps: SymbolKey[][][] = [];
  let grid = input.baseGrid.map((c) => [...c]);
  let locked = grid.map((c) => c.map((v) => v === BONUS));
  let respins = 3;
  let idx = 2000; // consume rng indices far away from base spin

  const coinValue = (r: number) => {
    // multipliers (small to big)
    const table = [0.5, 1, 1, 2, 2, 5, 10];
    const i = Math.min(table.length - 1, Math.floor(r * table.length));
    return table[i]!;
  };

  // Convert any existing BONUS positions into locked coins (keep symbol)
  steps.push(grid.map((c) => [...c]));

  while (respins > 0) {
    let added = 0;
    for (let x = 0; x < reels; x++) {
      for (let y = 0; y < rows; y++) {
        if (locked[x]![y]) continue;
        // Chance to land a coin in an empty spot. Keep it modest.
        const roll = input.rngFloat(idx++);
        if (roll < 0.12) {
          grid[x]![y] = BONUS;
          locked[x]![y] = true;
          added += 1;
        } else {
          // show blanks as filler symbol while spinning
          grid[x]![y] = "🍬";
        }
      }
    }
    steps.push(grid.map((c) => [...c]));
    if (added > 0) respins = 3;
    else respins -= 1;
  }

  // Payout: sum of coin values × wager. (Encode as multiplier)
  let sum = 0;
  for (let x = 0; x < reels; x++) {
    for (let y = 0; y < rows; y++) {
      if (locked[x]![y]) {
        sum += coinValue(input.rngFloat(idx++));
      }
    }
  }
  const scale = Math.min(10, Math.max(0.1, input.payoutScale || 1));
  const payoutMultiplier = sum * scale;
  return { steps, payoutMultiplier };
}

function withLuckyModifiers(input: {
  grid: SymbolKey[][];
  rngFloat: (i: number) => number;
  ensureMinScatters: number;
  extraWildChance: number; // 0..1
}) {
  const { grid, rngFloat } = input;
  const reels = grid.length;
  const rows = grid[0]?.length ?? 0;

  // Ensure at least N scatters
  let scatters = 0;
  for (let x = 0; x < reels; x++) for (let y = 0; y < rows; y++) if (grid[x]![y] === SCATTER) scatters += 1;
  let idx = 3000;
  while (scatters < input.ensureMinScatters) {
    const x = Math.floor(rngFloat(idx++) * reels);
    const y = Math.floor(rngFloat(idx++) * rows);
    if (grid[x]![y] !== SCATTER) {
      grid[x]![y] = SCATTER;
      scatters += 1;
    }
  }

  // Extra wild modifier: chance to turn a random non-scatter into wild
  if (rngFloat(3999) < input.extraWildChance) {
    const x = Math.floor(rngFloat(4000) * reels);
    const y = Math.floor(rngFloat(4001) * rows);
    if (grid[x]![y] !== SCATTER) grid[x]![y] = WILD;
  }

  return grid;
}

export function spinSlots243Ways(input: {
  rngFloat: (i: number) => number;
  mode: SpinMode;
  payoutScale: number;
  extraChanceProbability: number; // 0..1
  heldColumns?: Array<SymbolKey[] | null>; // length 5
  nudge?: Array<number | null>; // length 5, rotate held column before spin
  lucky?: {
    scatterWeightMultiplier: number; // e.g. 1.25
    ensureMinScatters: number; // e.g. 2
    extraWildChance: number; // e.g. 0.25
  };
}): SpinResult {
  const reels = 5;
  const rows = 3;

  // Build initial grid
  const baseGrid: SymbolKey[][] = Array.from({ length: reels }, (_, x) => {
    const held = input.heldColumns?.[x] ?? null;
    const nud = input.nudge?.[x] ?? 0;
    if (held && held.length === rows) {
      return rotateColumn(held, nud);
    }
    return Array.from({ length: rows }, (_, y) => {
      // Lucky spin: slightly boost scatter frequency by rerolling into scatter sometimes.
      const picked = weightedPick(input.rngFloat(x * 10 + y));
      const lucky = input.lucky;
      if (lucky && picked !== SCATTER) {
        // probabilistic upgrade: scatterWeightMultiplier-1 portion
        const boost = Math.max(0, lucky.scatterWeightMultiplier - 1);
        if (boost > 0 && input.rngFloat(8000 + x * 10 + y) < boost * 0.08) return SCATTER;
      }
      return picked;
    });
  });

  if (input.lucky && input.mode === "base") {
    withLuckyModifiers({
      grid: baseGrid,
      rngFloat: input.rngFloat,
      ensureMinScatters: input.lucky.ensureMinScatters,
      extraWildChance: input.lucky.extraWildChance,
    });
  }

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

  // Hold & Spin bonus trigger (base game only): 3+ bonus coins anywhere.
  const bonusCoins = countBonusCoins(baseGrid);
  const triggeredHoldSpin = input.mode === "base" && bonusCoins >= 3;
  let holdSpin: SpinResult["holdSpin"] | undefined;
  if (triggeredHoldSpin) {
    holdSpin = simulateHoldSpin({
      baseGrid,
      rngFloat: input.rngFloat,
      payoutScale: input.payoutScale,
    });
    winMultiplier += holdSpin.payoutMultiplier;
    outcomeParts.push(`HOLD&SPIN +${holdSpin.payoutMultiplier.toFixed(2)}x`);
  }

  return {
    grid: expanded.grid,
    scatterCount,
    winMultiplier,
    outcome: outcomeParts.join(" • "),
    triggeredFreeSpins,
    extraChanceTriggered,
    expandedWildReels: expanded.expandedWildReels,
    triggeredHoldSpin,
    holdSpin,
  };
}
