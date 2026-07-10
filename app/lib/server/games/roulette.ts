import { GameEngine, type RNG } from "./base";
import { EUROPEAN_ORDER, colorOf, payoutMultiplierForKey, type BetKey } from "../../../casino/roulette/rouletteMath";

export type RouletteBetMap = Record<BetKey, number>;

export interface RouletteInput {
  bets: RouletteBetMap;
}

export interface RouletteMetadata {
  spun: number;
  color: "red" | "black" | "green";
  totalReturn: number;
  [key: string]: unknown;
}

export class RouletteEngine extends GameEngine<RouletteInput> {
  readonly gameType = "Roulette" as const;
  readonly config = {
    houseEdge: 0.027,
    minWager: 0.01,
    maxWager: 100000,
    payoutScale: 1,
  };

  validateInput(input: RouletteInput): string | null {
    const total = Object.values(input.bets).reduce((a, b) => a + (Number(b) || 0), 0);
    if (total <= 0) return "Total wager must be positive.";
    for (const [key, amount] of Object.entries(input.bets)) {
      if (amount < 0) return "Bet amounts must be non-negative.";
      if (!key.startsWith("n:") && !["red", "black", "odd", "even", "low", "high"].includes(key)) {
        return `Invalid bet key: ${key}`;
      }
    }
    return null;
  }

  calculateOutcome(input: RouletteInput, rng: RNG): {
    multiplier: number;
    outcome: string;
    metadata: RouletteMetadata;
  } {
    const spun = rng.int(0, 37);
    const spunColor = colorOf(spun);
    const totalWager = Object.values(input.bets).reduce((a, b) => a + (Number(b) || 0), 0);

    let totalReturn = 0;
    for (const [key, amount] of Object.entries(input.bets)) {
      const stake = Number(amount) || 0;
      if (stake <= 0) continue;
      const m = payoutMultiplierForKey(key as BetKey, spun);
      totalReturn += stake * m;
    }

    const multiplier = totalWager > 0 ? totalReturn / totalWager : 0;
    const outcome = `Spun ${spun} (${spunColor}). Return ${totalReturn.toFixed(2)} on stake ${totalWager.toFixed(2)}.`;

    return {
      multiplier,
      outcome,
      metadata: {
        spun,
        color: spunColor,
        totalReturn,
      },
    };
  }
}

export const rouletteEngine = new RouletteEngine();
