import { BLACKJACK } from "../../shared/constants";

// ---------------------------------------------------------------------------
// Card encoding (legacy contract — preserved verbatim)
// ---------------------------------------------------------------------------
// Cards are integer indices.
//   - Standard cards: index < 1000.
//       rank = index % 13            (0 => "A", 1 => "2", ... 10 => "J", 12 => "K")
//       suit = floor(index / 13) % 4 (0 => ♠, 1 => ♥, 2 => ♦, 3 => ♣)
//   - Magic cards:    index >= 1000.
//       1000 + suitIdx*20 + rankCode
//       rankCode: 0 => JOKER, 1 => A, 11 => J, 12 => Q, 13 => K
// The shoe is 4 decks (208 cards) + 8 jokers = 216 cards.
// ---------------------------------------------------------------------------

export type Suit = "♠" | "♥" | "♦" | "♣" | "★";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "JOKER";

export interface Card {
  rank: Rank;
  suit: Suit;
  value: number;
}

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const MAGIC_CARD_BASE = 1000;

export type MagicRank = "A" | "K" | "Q" | "J" | "JOKER";

function magicRankCode(r: MagicRank): number {
  if (r === "JOKER") return 0;
  if (r === "A") return 1;
  if (r === "J") return 11;
  if (r === "Q") return 12;
  return 13;
}

export function encodeMagicCard(rank: MagicRank, suitIdx: number): number {
  return MAGIC_CARD_BASE + suitIdx * 20 + magicRankCode(rank);
}

// Deterministic linear congruential generator used for all card RNG (provably fair
// when seeded with a committed server seed). Same constants as the legacy engine.
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s % 1_000_000) / 1_000_000;
  };
}

export function cardFromIndex(i: number): Card {
  if (i >= MAGIC_CARD_BASE) {
    const t = i - MAGIC_CARD_BASE;
    const suitIdx = Math.floor(t / 20);
    const code = t % 20;
    if (code === 0) return { rank: "JOKER", suit: "★", value: 0 };
    const suit = (["♠", "♥", "♦", "♣"] as const)[Math.max(0, Math.min(3, suitIdx))]!;
    const rank = (code === 1 ? "A" : code === 11 ? "J" : code === 12 ? "Q" : "K") as Rank;
    const value = rank === "A" ? 1 : 10;
    return { rank, suit, value };
  }
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

// Evaluate a hand. Aces start at 1 and one may be promoted to 11 if total <= 21.
// `bonusPoints` (from powerups) are added after ace promotion; the `soft` flag does
// NOT account for bonus points, matching legacy behaviour.
export function handTotal(cards: number[], bonusPoints = 0): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    const c = cardFromIndex(idx);
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  total += aces;
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += bonusPoints;
  return { total, soft };
}

// Build a fresh shoe: 4 standard decks + 8 jokers, Fisher–Yates shuffled with the LCG.
export function shuffleDeck(seed: number): number[] {
  const rand = lcg(seed);
  const d: number[] = [];
  for (let deck = 0; deck < BLACKJACK.SHOE_DECKS; deck += 1) {
    for (let i = 0; i < 52; i += 1) d.push(i);
  }
  for (let i = 0; i < BLACKJACK.SHOE_JOKERS; i += 1) d.push(encodeMagicCard("JOKER", i % 4));
  for (let i = d.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

export function ranksEqualForSplit(cardA: number, cardB: number): boolean {
  try {
    return cardFromIndex(cardA).rank === cardFromIndex(cardB).rank;
  } catch {
    return false;
  }
}

// Perfect Pairs side bet multiplier. 0 => no pair, 7 => same rank diff color,
// 13 => same rank same color, 26 => same rank same suit.
export function perfectPairsMultiplier(cardA: number, cardB: number): number {
  try {
    const a = cardFromIndex(cardA);
    const b = cardFromIndex(cardB);
    if (a.rank !== b.rank) return 0;
    const aRed = a.suit === "♥" || a.suit === "♦";
    const bRed = b.suit === "♥" || b.suit === "♦";
    if (a.suit === b.suit) return BLACKJACK.PERFECT_PAIRS_SAME_SUIT;
    if (aRed === bRed) return BLACKJACK.PERFECT_PAIRS_SAME_COLOR;
    return BLACKJACK.PERFECT_PAIRS_SAME_RANK;
  } catch {
    return 0;
  }
}
