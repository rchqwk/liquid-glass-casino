import { GameEngine, type RNG } from "./base";

export type SymbolId10x10 =
  | "cherry"
  | "lemon"
  | "bell"
  | "star"
  | "seven"
  | "bar"
  | "diamond"
  | "coin";

export const WILD_10x10: SymbolId10x10 = "diamond";
export const SCATTER_10x10: SymbolId10x10 = "coin";

export type SpinMode10x10 = "base" | "freespin";

export interface ClusterInfo {
  symbol: Exclude<SymbolId10x10, typeof SCATTER_10x10>;
  cells: Array<{ x: number; y: number }>;
  size: number;
  pay: number;
}

export interface CascadeStep {
  phase: "break" | "drop";
  grid: (SymbolId10x10 | null)[][];
  clusters?: ClusterInfo[];
  dropOffsets?: number[][];
}

export interface Slots10x10Metadata {
  finalGrid: (SymbolId10x10 | null)[][];
  steps: CascadeStep[];
  scatterCount: number;
  featureTier: number;
  [key: string]: unknown;
}

const SYMBOLS_10x10: { s: SymbolId10x10; w: number }[] = [
  { s: "cherry", w: 50 },
  { s: "lemon", w: 45 },
  { s: "bar", w: 40 },
  { s: "bell", w: 20 },
  { s: "star", w: 12 },
  { s: "seven", w: 7 },
  { s: "diamond", w: 3 },
  { s: "coin", w: 2 },
];

const CLUSTER_PAY: Record<Exclude<SymbolId10x10, typeof SCATTER_10x10>, Record<number, number>> = {
  cherry: { 6: 0.2, 8: 0.5, 10: 1.0, 12: 2.0 },
  lemon: { 6: 0.25, 8: 0.6, 10: 1.2, 12: 2.5 },
  bar: { 6: 0.3, 8: 0.8, 10: 1.6, 12: 3.5 },
  bell: { 6: 0.5, 8: 1.5, 10: 3.5, 12: 8.0 },
  star: { 6: 1.0, 8: 3.0, 10: 8.0, 12: 20.0 },
  seven: { 6: 2.0, 8: 6.0, 10: 15.0, 12: 40.0 },
  diamond: { 6: 3.0, 8: 10.0, 10: 25.0, 12: 75.0 },
};

function weightedPick10x10(r01: number): SymbolId10x10 {
  const total = SYMBOLS_10x10.reduce((a, b) => a + b.w, 0);
  let x = r01 * total;
  for (const it of SYMBOLS_10x10) {
    x -= it.w;
    if (x <= 0) return it.s;
  }
  return SYMBOLS_10x10[0]!.s;
}

function findClusters(
  grid: (SymbolId10x10 | null)[][],
  minSize: number = 6
): ClusterInfo[] {
  const clusters: ClusterInfo[] = [];
  const visited = new Set<string>();
  const width = grid.length;
  const height = grid[0]?.length ?? 0;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const sym = grid[x]![y];
      if (sym == null || sym === SCATTER_10x10) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const cells: Array<{ x: number; y: number }> = [];
      const queue: Array<{ x: number; y: number }> = [{ x, y }];
      visited.add(key);

      while (queue.length > 0) {
        const c = queue.shift()!;
        cells.push(c);
        const neighbors = [
          { x: c.x - 1, y: c.y },
          { x: c.x + 1, y: c.y },
          { x: c.x, y: c.y - 1 },
          { x: c.x, y: c.y + 1 },
        ];
        for (const n of neighbors) {
          if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
          const nKey = `${n.x},${n.y}`;
          if (visited.has(nKey)) continue;
          const nSym = grid[n.x]![n.y];
          if (nSym === sym || nSym === WILD_10x10) {
            visited.add(nKey);
            queue.push(n);
          }
        }
      }

      if (cells.length >= minSize) {
        const symbol = sym === WILD_10x10 ? "seven" : (sym as Exclude<SymbolId10x10, typeof SCATTER_10x10>);
        const size = cells.length;
        const payTable = CLUSTER_PAY[symbol];
        let pay = 0;
        for (const [threshold, mult] of Object.entries(payTable)) {
          if (size >= Number(threshold)) pay = mult;
        }
        clusters.push({ symbol, cells, size, pay });
      }
    }
  }

  return clusters;
}

function breakClusters(
  grid: (SymbolId10x10 | null)[][],
  clusters: ClusterInfo[]
): (SymbolId10x10 | null)[][] {
  const newGrid = grid.map((col) => [...col]) as (SymbolId10x10 | null)[][];
  for (const c of clusters) {
    for (const cell of c.cells) {
      newGrid[cell.x]![cell.y] = null;
    }
  }
  return newGrid;
}

function dropSymbols(
  grid: (SymbolId10x10 | null)[][]
): { newGrid: (SymbolId10x10 | null)[][]; offsets: number[][] } {
  const width = grid.length;
  const height = grid[0]?.length ?? 0;
  const newGrid: (SymbolId10x10 | null)[][] = Array.from({ length: width }, () =>
    Array.from({ length: height }, () => null as SymbolId10x10 | null)
  );
  const offsets: number[][] = Array.from({ length: width }, () =>
    Array.from({ length: height }, () => 0)
  );

  for (let x = 0; x < width; x++) {
    let writeY = height - 1;
    let nullCount = 0;
    for (let y = height - 1; y >= 0; y--) {
      const sym = grid[x]![y];
      if (sym != null) {
        newGrid[x]![writeY] = sym;
        offsets[x]![y] = nullCount;
        writeY--;
      } else {
        nullCount++;
      }
    }
  }

  return { newGrid, offsets };
}

function fillEmpty(
  grid: (SymbolId10x10 | null)[][],
  rng: RNG
): SymbolId10x10[][] {
  const width = grid.length;
  const height = grid[0]?.length ?? 0;
  const result: SymbolId10x10[][] = Array.from({ length: width }, (_, x) =>
    Array.from({ length: height }, (_, y) => {
      const sym = grid[x]![y];
      return sym ?? weightedPick10x10(rng.float());
    })
  );
  return result;
}

function countScatters10x10(grid: SymbolId10x10[][]): number {
  let count = 0;
  for (const col of grid) {
    for (const cell of col) {
      if (cell === SCATTER_10x10) count++;
    }
  }
  return count;
}

export interface Slots10x10Input {
  wager: number;
  mode: SpinMode10x10;
  minCluster?: number;
  featureTier?: number;
  payoutScale?: number;
  lucky?: {
    scatterWeightMultiplier: number;
    ensureMinScatters: number;
    extraWildChance: number;
  };
}

export class Slots10x10Engine extends GameEngine<Slots10x10Input> {
  readonly gameType = "Slots10x10" as const;
  readonly config = {
    houseEdge: 0.04,
    minWager: 0.01,
    maxWager: 10000,
    payoutScale: 1,
  };

  validateInput(input: Slots10x10Input): string | null {
    if (!Number.isFinite(input.wager) || input.wager <= 0) {
      return "Invalid wager.";
    }
    if (!["base", "freespin"].includes(input.mode)) {
      return "Invalid spin mode.";
    }
    return null;
  }

  calculateOutcome(input: Slots10x10Input, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata: Slots10x10Metadata;
  } {
    const minCluster = input.minCluster ?? 6;
    const featureTier = input.featureTier ?? 0;
    const payoutScale = input.payoutScale ?? 1;
    const isFree = input.mode === "freespin";
    const tierScale = isFree && featureTier === 2 ? 1.8 : isFree && featureTier === 1 ? 1.3 : 1;

    const steps: CascadeStep[] = [];
    let totalWin = 0;
    let currentGrid: SymbolId10x10[][] = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => {
        const sym = weightedPick10x10(rng.float());
        const lucky = input.lucky;
        if (lucky && !isFree && sym !== SCATTER_10x10) {
          const boost = Math.max(0, lucky.scatterWeightMultiplier - 1);
          if (boost > 0 && rng.float() < boost * 0.08) return SCATTER_10x10;
        }
        return sym;
      })
    );

    if (input.lucky && !isFree) {
      let scatters = countScatters10x10(currentGrid);
      while (scatters < input.lucky.ensureMinScatters) {
        const x = rng.int(0, 9);
        const y = rng.int(0, 9);
        if (currentGrid[x]![y] !== SCATTER_10x10) {
          currentGrid[x]![y] = SCATTER_10x10;
          scatters++;
        }
      }
      if (rng.float() < input.lucky.extraWildChance) {
        const x = rng.int(0, 9);
        const y = rng.int(0, 9);
        if (currentGrid[x]![y] !== SCATTER_10x10) currentGrid[x]![y] = WILD_10x10;
      }
    }

    let cascadeCount = 0;
    const maxCascades = 20;

    while (cascadeCount < maxCascades) {
      const clusters = findClusters(currentGrid, minCluster);
      if (clusters.length === 0) break;

      const breakGrid = breakClusters(currentGrid, clusters);
      steps.push({
        phase: "break",
        grid: breakGrid,
        clusters,
      });

      const clusterWin = clusters.reduce((a, c) => a + c.pay, 0);
      totalWin += clusterWin * tierScale * payoutScale;

      const { newGrid, offsets } = dropSymbols(breakGrid);
      steps.push({
        phase: "drop",
        grid: newGrid,
        dropOffsets: offsets,
      });

      currentGrid = fillEmpty(newGrid, rng);
      cascadeCount++;
    }

    const scatterCount = countScatters10x10(currentGrid);
    const multiplier = (isFree ? 1 : 0) + totalWin;
    const outcome = multiplier > 0 ? `WIN +${multiplier.toFixed(2)}x` : "LOSE";

    return {
      multiplier,
      outcome,
      metadata: {
        finalGrid: currentGrid,
        steps,
        scatterCount,
        featureTier,
      },
    };
  }
}

export const slots10x10Engine = new Slots10x10Engine();
