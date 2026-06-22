export type Suit = "♠" | "♥" | "♦" | "♣" | "★";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "JOKER";

export type Card = { rank: Rank; suit: Suit; value: number };

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const MAGIC_CARD_BASE = 1000;
export type MagicRank = "A" | "K" | "Q" | "J" | "JOKER";

function magicRankCode(r: MagicRank) {
  if (r === "JOKER") return 0;
  if (r === "A") return 1;
  if (r === "J") return 11;
  if (r === "Q") return 12;
  return 13;
}

export function encodeMagicCard(rank: MagicRank, suitIdx: number) {
  return MAGIC_CARD_BASE + suitIdx * 20 + magicRankCode(rank);
}

function lcg(seed: number) {
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

export function shuffleDeck(seed: number) {
  const rand = lcg(seed);
  const d: number[] = [];
  for (let deck = 0; deck < 4; deck += 1) {
    for (let i = 0; i < 52; i += 1) d.push(i);
  }
  for (let i = 0; i < 8; i += 1) d.push(encodeMagicCard("JOKER", i % 4));
  for (let i = d.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

export function ranksEqualForSplit(cardA: number, cardB: number) {
  try {
    return cardFromIndex(cardA).rank === cardFromIndex(cardB).rank;
  } catch {
    return false;
  }
}

export function perfectPairsMultiplier(cardA: number, cardB: number): number {
  try {
    const a = cardFromIndex(cardA);
    const b = cardFromIndex(cardB);
    if (a.rank !== b.rank) return 0;
    const aRed = a.suit === "♥" || a.suit === "♦";
    const bRed = b.suit === "♥" || b.suit === "♦";
    if (a.suit === b.suit) return 26;
    if (aRed === bRed) return 13;
    return 7;
  } catch {
    return 0;
  }
}
