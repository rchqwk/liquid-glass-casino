"use client";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { rank: string; suit: Suit; value: number };

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

export function handValue(cards: number[], bonusPoints = 0) {
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

export function CardView({ idx, hidden }: { idx: number; hidden?: boolean }) {
  if (idx < 0 || hidden) {
    return (
      <div className="relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      </div>
    );
  }
  const c = cardFromIndex(idx);
  const isRed = c.suit === "♥" || c.suit === "♦";
  return (
    <div className="relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
      <div className={`absolute left-2 top-2 text-[9px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[8px] leading-3">{c.suit}</div>
      </div>
      <div className={`text-lg ${isRed ? "text-rose-600" : "text-zinc-900"}`}>{c.suit}</div>
      <div className={`absolute bottom-2 right-2 rotate-180 text-[9px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[8px] leading-3">{c.suit}</div>
      </div>
    </div>
  );
}
