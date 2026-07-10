import { GameEngine, type RNG } from "./base";
import {
  spinSlots243Ways,
  analyzeWaysWin,
  WILD,
  SCATTER,
  BONUS,
  type SymbolKey,
  type SpinMode,
  type SpinResult,
  type WaysWinInfo,
} from "../../../casino/slots/slotEngine";

export interface Slots5x3Input {
  wager: number;
  mode: SpinMode;
  extraChanceProbability: number;
  heldColumns?: Array<SymbolKey[] | null>;
  nudge?: Array<number | null>;
  lucky?: {
    scatterWeightMultiplier: number;
    ensureMinScatters: number;
    extraWildChance: number;
  };
  forceHoldSpin?: boolean;
  payoutScale?: number;
}

export interface Slots5x3Metadata {
  grid: SymbolKey[][];
  scatterCount: number;
  triggeredFreeSpins: boolean;
  triggeredHoldSpin: boolean;
  holdSpinPayout?: number;
  waysWin: WaysWinInfo | null;
  [key: string]: unknown;
}

export class Slots5x3Engine extends GameEngine<Slots5x3Input> {
  readonly gameType = "Slots5x3" as const;
  readonly config = {
    houseEdge: 0.04,
    minWager: 0.01,
    maxWager: 10000,
    payoutScale: 1,
  };

  validateInput(input: Slots5x3Input): string | null {
    if (!Number.isFinite(input.wager) || input.wager <= 0) {
      return "Invalid wager.";
    }
    if (!["base", "freespin"].includes(input.mode)) {
      return "Invalid spin mode.";
    }
    if (input.extraChanceProbability < 0 || input.extraChanceProbability > 1) {
      return "Extra chance probability must be between 0 and 1.";
    }
    return null;
  }

  calculateOutcome(input: Slots5x3Input, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata: Slots5x3Metadata;
  } {
    const result = spinSlots243Ways({
      rngFloat: rng.float,
      mode: input.mode,
      payoutScale: input.payoutScale ?? this.config.payoutScale,
      extraChanceProbability: input.extraChanceProbability,
      heldColumns: input.heldColumns,
      nudge: input.nudge,
      lucky: input.lucky,
      forceHoldSpin: input.forceHoldSpin,
    });

    const waysWin = analyzeWaysWin(result.grid);

    return {
      multiplier: result.winMultiplier,
      outcome: result.outcome,
      metadata: {
        grid: result.grid,
        scatterCount: result.scatterCount,
        triggeredFreeSpins: result.triggeredFreeSpins,
        triggeredHoldSpin: result.triggeredHoldSpin,
        holdSpinPayout: result.holdSpin?.payoutMultiplier,
        waysWin: waysWin
          ? { symbol: waysWin.symbol, len: waysWin.len, ways: waysWin.ways, pay: waysWin.pay, matched: waysWin.matched }
          : null,
      },
    };
  }
}

export const slots5x3Engine = new Slots5x3Engine();
