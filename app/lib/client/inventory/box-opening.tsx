"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type BoxTier = "normal" | "rare" | "legendary" | "mythic";
export type ItemRarity = "common" | "rare" | "legendary" | "mythic";

export const BOX_TIER_COLORS: Record<BoxTier | ItemRarity, { bg: string; glow: string; ring: string; shimmer: string }> = {
  common: {
    bg: "bg-slate-600/80",
    glow: "shadow-slate-500/30",
    ring: "border-slate-500",
    shimmer: "from-slate-400/20",
  },
  normal: {
    bg: "bg-amber-700/80",
    glow: "shadow-amber-500/30",
    ring: "border-amber-600",
    shimmer: "from-amber-400/20",
  },
  rare: {
    bg: "bg-blue-700/80",
    glow: "shadow-blue-500/50",
    ring: "border-blue-400",
    shimmer: "from-blue-400/30",
  },
  legendary: {
    bg: "bg-amber-500/80",
    glow: "shadow-amber-400/60",
    ring: "border-amber-300",
    shimmer: "from-amber-300/40",
  },
  mythic: {
    bg: "bg-purple-700/80",
    glow: "shadow-purple-500/70",
    ring: "border-purple-400",
    shimmer: "from-purple-400/40",
  },
};

export const BOX_TIER_LABELS: Record<BoxTier, string> = {
  normal: "Normal Box",
  rare: "Rare Box",
  legendary: "Legendary Box",
  mythic: "Mythic Box",
};

export interface BoxOpeningResult {
  tier: BoxTier;
  contents: Array<{ id: string; name: string; rarity: "common" | "rare" | "legendary" | "mythic" }>;
}

export function BoxIcon({ tier, size = 48, animate = false }: { tier: BoxTier; size?: number; animate?: boolean }) {
  const colors = BOX_TIER_COLORS[tier];
  const pulseClass = animate ? "animate-pulse" : "";

  return (
    <div
      className={`relative flex items-center justify-center rounded-lg ${colors.bg} ${colors.ring} border-2 ${colors.glow} shadow-lg ${pulseClass}`}
      style={{ width: size, height: size }}
    >
      <span className="text-xl">📦</span>
      {tier === "rare" && (
        <div className="absolute inset-0 animate-spin-slow rounded-lg bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />
      )}
      {tier === "legendary" && (
        <>
          <div className="absolute inset-0 animate-spin-slow rounded-lg bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <div className="absolute -inset-1 animate-ping rounded-lg bg-amber-400/20" />
        </>
      )}
      {tier === "mythic" && (
        <>
          <div className="absolute inset-0 animate-spin-slow rounded-lg bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
          <div className="absolute -inset-2 animate-pulse rounded-lg bg-purple-500/30" />
          <div className="absolute -inset-4 animate-ping-slow rounded-full bg-purple-400/20" />
        </>
      )}
    </div>
  );
}

export function BoxOpeningOverlay({
  tier,
  contents,
  isOpening,
  onReveal,
  onClose,
}: {
  tier: BoxTier;
  contents: Array<{ id: string; name: string; rarity: "common" | "rare" | "legendary" | "mythic" }>;
  isOpening: boolean;
  onReveal?: () => void;
  onClose?: () => void;
}) {
  const [phase, setPhase] = useState<"closed" | "opening" | "revealing" | "done">("closed");
  const [revealedCount, setRevealedCount] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpening && phase === "closed") {
      setPhase("opening");
      timeoutRef.current = window.setTimeout(() => {
        setPhase("revealing");
      }, tier === "mythic" ? 2000 : tier === "legendary" ? 1500 : 1000);
    }
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpening, phase, tier]);

  useEffect(() => {
    if (phase === "revealing" && revealedCount < contents.length) {
      const delay = 300 + revealedCount * 200;
      timeoutRef.current = window.setTimeout(() => {
        setRevealedCount((c) => c + 1);
      }, delay);
    } else if (phase === "revealing" && revealedCount >= contents.length) {
      timeoutRef.current = window.setTimeout(() => {
        setPhase("done");
      }, 500);
    }
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [phase, revealedCount, contents.length]);

  useEffect(() => {
    if (!isOpening && phase !== "closed") {
      setPhase("closed");
      setRevealedCount(0);
    }
  }, [isOpening, phase]);

  const colors = BOX_TIER_COLORS[tier];

  if (phase === "closed" && !isOpening) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal-scrim)] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className={`relative flex flex-col items-center gap-6 rounded-2xl ${colors.bg} p-8 ${colors.glow} shadow-2xl`}>
        {phase === "opening" && (
          <>
            <BoxIcon tier={tier} size={96} animate />
            <div className="text-lg font-bold text-white">{BOX_TIER_LABELS[tier]}</div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-white"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </>
        )}

        {phase === "revealing" && (
          <>
            <div className="text-lg font-bold text-white">You received:</div>
            <div className="flex flex-wrap justify-center gap-3">
              {contents.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-all duration-300 ${
                    i < revealedCount
                      ? "scale-100 opacity-100"
                      : "scale-75 opacity-0"
                  } ${BOX_TIER_COLORS[item.rarity]?.bg ?? "bg-white/10"}`}
                >
                  <span className="text-2xl">
                    {item.rarity === "mythic"
                      ? "✨"
                      : item.rarity === "legendary"
                        ? "⭐"
                        : item.rarity === "rare"
                          ? "💎"
                          : "📦"}
                  </span>
                  <span className="text-xs text-white">{item.name}</span>
                  {i === revealedCount - 1 && i < contents.length && (
                    <span className="animate-pulse text-[10px] text-emerald-300">NEW!</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="text-lg font-bold text-white">All items revealed!</div>
            <button
              onClick={() => {
                onReveal?.();
                onClose?.();
              }}
              className="rounded-lg bg-white/20 px-6 py-2 font-bold text-white hover:bg-white/30"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function BoxInventoryView({
  boxes,
  onOpenOne,
  onOpenAll,
  onTradeUp,
}: {
  boxes: { tier: BoxTier; count: number }[];
  onOpenOne?: (tier: BoxTier) => void;
  onOpenAll?: (tier: BoxTier) => void;
  onTradeUp?: (tier: BoxTier) => void;
}) {
  const totalBoxes = boxes.reduce((a, b) => a + b.count, 0);

  if (totalBoxes === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <div className="text-4xl opacity-50">📦</div>
        <p className="mt-2 text-sm text-white/60">No boxes yet.</p>
        <p className="text-xs text-white/40">Play 3 blackjack hands to earn one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {boxes.map(({ tier, count }) => (
        <div key={tier} className={`glass rounded-xl p-4 ${BOX_TIER_COLORS[tier].ring} border`}>
          <div className="flex items-center gap-3">
            <BoxIcon tier={tier} size={48} />
            <div className="flex-1">
              <div className="font-bold text-white">{BOX_TIER_LABELS[tier]}</div>
              <div className="text-sm text-white/60">x{count}</div>
            </div>
            <div className="flex gap-2">
              {onOpenOne && (
                <button
                  onClick={() => onOpenOne(tier)}
                  disabled={count <= 0}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  Open 1
                </button>
              )}
              {onOpenAll && count > 1 && (
                <button
                  onClick={() => onOpenAll(tier)}
                  className="rounded-lg bg-blue-500/20 px-3 py-1 text-sm text-blue-300 hover:bg-blue-500/30"
                >
                  Open All
                </button>
              )}
            </div>
          </div>
          {onTradeUp && count >= 3 && tier !== "mythic" && (
            <button
              onClick={() => onTradeUp(tier)}
              className="mt-3 w-full rounded-lg bg-amber-500/20 py-1 text-sm text-amber-300 hover:bg-amber-500/30"
            >
              Trade 3 for 1 {BOX_TIER_LABELS[getNextTier(tier)]}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function getNextTier(tier: BoxTier): BoxTier {
  switch (tier) {
    case "normal":
      return "rare";
    case "rare":
      return "legendary";
    case "legendary":
      return "mythic";
    default:
      return "mythic";
  }
}

export function canTradeUp(tier: BoxTier, count: number): boolean {
  return tier !== "mythic" && count >= 3;
}
