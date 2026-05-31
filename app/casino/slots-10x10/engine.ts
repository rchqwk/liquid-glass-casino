"use client";

// 10x10 cluster (match-group) slot: 6+ connected orthogonally breaks, pays, then gravity drop, chain possible.

export type SymbolId =
  | "cherry"
  | "lemon"
  | "bar"
  | "bell"
  | "star"
  | "seven"
  | "diamond" // wild
  | "coin"; // scatter

export const WILD: SymbolId = "diamond";
export const SCATTER: SymbolId = "coin";

export type Mode = "base" | "freespin";

export type Cluster = {
  symbol: SymbolId;
  cells: Array<{ x: number; y: number }>;
  pay: number; // multiplier contribution for this cluster
};

export type CascadeStep = {
  phase: "break" | "drop";
  grid: (SymbolId | null)[][]; // [x][y], with null meaning empty after break (before drop)
  clusters: Cluster[];
  // For phase==="drop": initial Y offset (in cells) for each cell before easing to 0.
  // Negative means starting above, positive means starting below (rare).
  dropOffsets?: number[][]; // [x][y]
};

export type SpinResult = {
  finalGrid: SymbolId[][];
  steps: CascadeStep[];
  scatterCount: number;
  winMultiplier: number;
  triggeredFS: 0 | 1 | 2; // 0 none, 1 normal, 2 super
};

const SYMBOLS: { s: SymbolId; w: number }[] = [
  { s: "cherry", w: 36 },
  { s: "lemon", w: 36 },
  { s: "bar", w: 28 },
  { s: "bell", w: 18 },
  { s: "star", w: 12 },
  { s: "seven", w: 7 },
  { s: "diamond", w: 2 },
  { s: "coin", w: 1.6 },
];

const BASE_PAY: Record<SymbolId, number> = {
  cherry: 0.02,
  lemon: 0.02,
  bar: 0.03,
  bell: 0.05,
  star: 0.08,
  seven: 0.12,
  diamond: 0.1,
  coin: 0,
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

function cloneGrid<T>(g: T[][]): T[][] {
  return g.map((col) => [...col]);
}

function countScatters(grid: SymbolId[][]) {
  let c = 0;
  for (let x = 0; x < grid.length; x++) for (let y = 0; y < grid[x]!.length; y++) if (grid[x]![y] === SCATTER) c += 1;
  return c;
}

function neighbors(x: number, y: number) {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ] as const;
}

function findClusters(grid: SymbolId[][], minSize: number): Cluster[] {
  const w = grid.length;
  const h = grid[0]?.length ?? 0;
  const seen: boolean[][] = Array.from({ length: w }, () => Array.from({ length: h }, () => false));
  const out: Cluster[] = [];

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (seen[x]![y]) continue;
      const sym = grid[x]![y]!;
      seen[x]![y] = true;

      // scatters don't break
      if (sym === SCATTER) continue;

      const stack: Array<{ x: number; y: number }> = [{ x, y }];
      const cells: Array<{ x: number; y: number }> = [];
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [nx, ny] of neighbors(cur.x, cur.y)) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[nx]![ny]) continue;
          const v = grid[nx]![ny]!;
          // wild counts as matching any non-scatter for clustering
          const match =
            v === sym || v === WILD || sym === WILD;
          if (!match || v === SCATTER) continue;
          seen[nx]![ny] = true;
          stack.push({ x: nx, y: ny });
        }
      }

      if (cells.length >= minSize) {
        const paySym = sym === SCATTER ? "cherry" : sym;
        const base = BASE_PAY[paySym === WILD ? WILD : paySym];
        // size scaling (feature can get huge with chains): quadratic-ish
        const pay = base * Math.pow(cells.length / minSize, 2) * cells.length;
        out.push({ symbol: sym, cells, pay });
      }
    }
  }

  return out;
}

function applyBreak(grid: SymbolId[][], clusters: Cluster[]) {
  const g: (SymbolId | null)[][] = cloneGrid(grid) as any;
  for (const c of clusters) {
    for (const { x, y } of c.cells) {
      g[x]![y] = null;
    }
  }
  return g;
}

function dropAndRefill(input: {
  grid: (SymbolId | null)[][];
  rngFloat: (i: number) => number;
  startIndex: number;
}) {
  const w = input.grid.length;
  const h = input.grid[0]?.length ?? 0;
  const out: SymbolId[][] = Array.from({ length: w }, () => Array.from({ length: h }, () => "cherry"));
  const offsets: number[][] = Array.from({ length: w }, () => Array.from({ length: h }, () => 0));
  let idx = input.startIndex;

  for (let x = 0; x < w; x++) {
    const col = input.grid[x]!;
    const keptWithY = col
      .map((v, y) => ({ v, y }))
      .filter((it) => it.v != null) as Array<{ v: SymbolId; y: number }>;
    const kept = keptWithY.map((k) => k.v);
    const missing = h - kept.length;
    const refill: SymbolId[] = Array.from({ length: missing }, () => weightedPick(input.rngFloat(idx++)));
    const next = [...refill, ...kept];

    // Offsets (in cells): where the symbol came from relative to where it ends up.
    // Refilled symbols start above the top.
    for (let y = 0; y < h; y++) {
      out[x]![y] = next[y]!;
      if (y < missing) {
        const oldY = y - missing; // negative
        offsets[x]![y] = oldY - y;
      } else {
        const keptIdx = y - missing;
        const oldY = keptWithY[keptIdx]?.y ?? y;
        offsets[x]![y] = oldY - y;
      }
    }
  }

  return { grid: out, nextIndex: idx, offsets };
}

export function spinCluster10x10(input: {
  rngFloat: (i: number) => number;
  mode: Mode;
  payoutScale: number;
  minCluster: number; // 6
  featureTier: 0 | 1 | 2; // affects multipliers
  lucky?: {
    scatterWeightMultiplier: number; // e.g. 1.25
    ensureMinScatters: number; // e.g. 2
    extraWildChance: number; // e.g. 0.25
  };
}): SpinResult {
  const w = 10;
  const h = 10;
  const start: SymbolId[][] = Array.from({ length: w }, (_, x) =>
    Array.from({ length: h }, (_, y) => {
      const picked = weightedPick(input.rngFloat(x * 32 + y));
      const lucky = input.lucky;
      if (lucky && input.mode === "base" && picked !== SCATTER) {
        const boost = Math.max(0, lucky.scatterWeightMultiplier - 1);
        if (boost > 0 && input.rngFloat(8000 + x * 32 + y) < boost * 0.03) return SCATTER;
      }
      return picked;
    }),
  );

  if (input.lucky && input.mode === "base") {
    // Ensure minimum scatters
    let scat = countScatters(start);
    let idx2 = 9000;
    while (scat < input.lucky.ensureMinScatters) {
      const x = Math.floor(input.rngFloat(idx2++) * w);
      const y = Math.floor(input.rngFloat(idx2++) * h);
      if (start[x]![y] !== SCATTER) {
        start[x]![y] = SCATTER;
        scat += 1;
      }
    }
    // Extra wild chance
    if (input.rngFloat(9999) < input.lucky.extraWildChance) {
      const x = Math.floor(input.rngFloat(10000) * w);
      const y = Math.floor(input.rngFloat(10001) * h);
      if (start[x]![y] !== SCATTER) start[x]![y] = WILD;
    }
  }

  const scatterCount = countScatters(start);

  const scale = Math.min(10, Math.max(0.1, input.payoutScale || 1));
  const tierMult = input.featureTier === 2 ? 2.4 : input.featureTier === 1 ? 1.4 : 1.0;

  const steps: CascadeStep[] = [];
  let cur = start;
  let total = 0;
  let idx = 10000;

  for (let chain = 0; chain < 40; chain++) {
    const clusters = findClusters(cur, input.minCluster);
    if (!clusters.length) break;
    const broken = applyBreak(cur, clusters);
    steps.push({ phase: "break", grid: broken, clusters });

    const chainMult = 1 + chain * 0.15; // increasing chain excitement
    total += clusters.reduce((a, c) => a + c.pay, 0) * chainMult;

    const dropped = dropAndRefill({ grid: broken, rngFloat: input.rngFloat, startIndex: idx });
    idx = dropped.nextIndex;
    steps.push({ phase: "drop", grid: dropped.grid as any, clusters: [], dropOffsets: dropped.offsets });
    cur = dropped.grid;
  }

  return {
    finalGrid: cur,
    steps,
    scatterCount,
    winMultiplier: total * scale * tierMult,
    triggeredFS: 0,
  };
}
