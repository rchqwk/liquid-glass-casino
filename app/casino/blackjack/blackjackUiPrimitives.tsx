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

export function PowerupStickerIcon({ id, className }: { id: string; className?: string }) {
  const base = `lgc-powerup-icon inline-block h-[14px] w-[14px] ${className ?? ""}`;

  const common = {
    className: base,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (id === "PEEK_NEXT") {
    return (
      <svg {...common}>
        <path d="M2.5 12s3.7-6.8 9.5-6.8S21.5 12 21.5 12s-3.7 6.8-9.5 6.8S2.5 12 2.5 12Z" />
        <path d="M14.7 12a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0Z" />
        <path d="M18 6.8 21.5 3.3" />
      </svg>
    );
  }

  if (id === "BJ_PROTECTOR") {
    return (
      <svg {...common}>
        <path d="M12 2.8 19.2 6v6.2c0 4.6-3.2 7.7-7.2 9-4-1.3-7.2-4.4-7.2-9V6L12 2.8Z" />
        <path d="M9.3 12.2 11.4 14.3 15.9 9.7" />
      </svg>
    );
  }

  if (id === "SWAP_ONE") {
    return (
      <svg {...common}>
        <path d="M7 7h10" />
        <path d="M15 4l2.8 3L15 10" />
        <path d="M17 17H7" />
        <path d="M9 20l-2.8-3L9 14" />
      </svg>
    );
  }

  if (id === "FREE_SPLIT") {
    return (
      <svg {...common}>
        <path d="M6.2 6.2h5.4v5.4H6.2z" />
        <path d="M12.4 12.4h5.4v5.4h-5.4z" />
        <path d="M11.6 11.6 15 8.2" />
      </svg>
    );
  }

  if (id === "DOUBLE_PAYOUT") {
    return (
      <svg {...common}>
        <path d="M6.5 9.5c1.2-1.8 3-2.7 5.5-2.7 2.7 0 4.7 1.1 5.7 3.2" />
        <path d="M6 15.6c1.3 1.2 3.1 1.8 5.4 1.8 2.6 0 4.6-.9 6-2.8" />
        <path d="M7.2 12h9.6" />
      </svg>
    );
  }

  if (id === "REMOVE_RANDOM_SELF") {
    return (
      <svg {...common}>
        <path d="M4.2 12.2 12 3.8l7.8 8.4-7.8 8.4-7.8-8.4Z" />
        <path d="M9.3 9.6h.01" />
        <path d="M14.7 9.6h.01" />
        <path d="M12 14.4h.01" />
      </svg>
    );
  }

  if (id === "REMOVE_CARD_SELF") {
    return (
      <svg {...common}>
        <path d="M7.2 6.2h9.6v11.6H7.2z" />
        <path d="M9 10.2h.01" />
        <path d="M11.9 10.2h.01" />
        <path d="M14.8 10.2h.01" />
        <path d="M18.8 5.2l2 2" />
      </svg>
    );
  }

  if (id === "DEALER_SECOND_CHANCE") {
    return (
      <svg {...common}>
        <path d="M6.2 9.2a6.8 6.8 0 0 1 11.8 2.8" />
        <path d="M17.8 14.8a6.8 6.8 0 0 1-11.8-2.8" />
        <path d="M6 5.8v3.8h3.8" />
        <path d="M18 18.2v-3.8h-3.8" />
      </svg>
    );
  }

  if (id.startsWith("SUB")) {
    return (
      <svg {...common}>
        <path d="M6 12h12" />
      </svg>
    );
  }

  if (id.startsWith("ADD")) {
    return (
      <svg {...common}>
        <path d="M12 6v12" />
        <path d="M6 12h12" />
      </svg>
    );
  }

  if (id.startsWith("MAGIC_") || id.includes("_MAGIC")) {
    return (
      <svg {...common}>
        <path d="M12 3.4 13.8 8.7 19.4 8.7 14.8 12 16.6 17.4 12 14.2 7.4 17.4 9.2 12 4.6 8.7 10.2 8.7 12 3.4Z" />
      </svg>
    );
  }

  if (id.startsWith("MYTHIC_")) {
    return (
      <svg {...common}>
        <path d="M8 8h9v9H8z" />
        <path d="M6.5 6.5h9v9" />
      </svg>
    );
  }

  return null;
}

export function CardView({ idx, hidden }: { idx: number; hidden?: boolean }) {
  if (idx < 0 || hidden) {
    return (
      <div className="lgc-card lgc-card--back relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      </div>
    );
  }
  const c = cardFromIndex(idx);
  const isRed = c.suit === "♥" || c.suit === "♦";
  return (
    <div className="lgc-card relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
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
