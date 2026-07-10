import { GameEngine, type RNG } from "./base";

export interface DiceInput {
  wager: number;
  target: number;
}

export interface DiceMetadata {
  roll: number;
  target: number;
  win: boolean;
  winMultiplier: number;
  [key: string]: unknown;
}

export class DiceEngine extends GameEngine<DiceInput> {
  readonly gameType = "Dice" as const;
  readonly config = {
    houseEdge: 0.01,
    minWager: 0.01,
    maxWager: 100000,
    payoutScale: 1,
  };

  validateInput(input: DiceInput): string | null {
    if (!Number.isFinite(input.wager) || input.wager <= 0) {
      return "Invalid wager.";
    }
    if (!Number.isFinite(input.target) || input.target < 2 || input.target > 98) {
      return "Target must be between 2 and 98.";
    }
    return null;
  }

  calculateWinMultiplier(target: number): number {
    const clampedTarget = Math.max(2, Math.min(98, target));
    return (100 * (1 - this.config.houseEdge)) / clampedTarget;
  }

  calculateOutcome(input: DiceInput, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata: DiceMetadata;
  } {
    const roll = rng.float() * 100;
    const win = roll < input.target;
    const winMultiplier = this.calculateWinMultiplier(input.target);
    const multiplier = win ? winMultiplier : 0;

    const outcome = `Roll ${roll.toFixed(2)} ${win ? "<" : "≥"} ${input.target.toFixed(2)}`;

    return {
      multiplier,
      outcome,
      metadata: {
        roll,
        target: input.target,
        win,
        winMultiplier,
      },
    };
  }
}

export const diceEngine = new DiceEngine();
