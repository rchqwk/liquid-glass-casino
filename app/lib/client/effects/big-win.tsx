"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export type BigWinTier = "nice" | "big" | "mega" | "epic" | "legendary";

export interface BigWinConfig {
  tier: BigWinTier;
  multiplier: number;
  profit: number;
  gameType: "blackjack" | "roulette" | "dice" | "slots";
  outcome: string;
}

export const BIG_WIN_THRESHOLDS: Record<BigWinTier, { minMult: number; color: string; label: string; emoji: string }> = {
  nice: { minMult: 2, color: "text-emerald-300", label: "NICE!", emoji: "✨" },
  big: { minMult: 4, color: "text-blue-300", label: "BIG WIN", emoji: "🎉" },
  mega: { minMult: 8, color: "text-purple-300", label: "MEGA WIN", emoji: "💎" },
  epic: { minMult: 20, color: "text-amber-300", label: "EPIC WIN", emoji: "🔥" },
  legendary: { minMult: 50, color: "text-rose-300", label: "LEGENDARY!", emoji: "👑" },
};

export function getBigWinTier(multiplier: number): BigWinTier {
  if (multiplier >= 50) return "legendary";
  if (multiplier >= 20) return "epic";
  if (multiplier >= 8) return "mega";
  if (multiplier >= 4) return "big";
  return "nice";
}

function formatWinAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function SpawnParticles({ count, color }: { count: number; color: string }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 0.5,
    size: 4 + Math.random() * 8,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute ${color} animate-fall`}
          style={{
            left: `${p.x}%`,
            top: "-20px",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function BigWinOverlay({
  config,
  duration = 4000,
  onDismiss,
}: {
  config: BigWinConfig;
  duration?: number;
  onDismiss?: () => void;
}) {
  const [phase, setPhase] = useState<"hidden" | "intro" | "show" | "outro">("hidden");
  const timerRef = useRef<number | null>(null);
  const tierConfig = BIG_WIN_THRESHOLDS[config.tier];

  useEffect(() => {
    setPhase("intro");
    timerRef.current = window.setTimeout(() => {
      setPhase("show");
    }, 300);

    const dismissTimer = window.setTimeout(() => {
      setPhase("outro");
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    }, duration);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  if (phase === "hidden") return null;

  const scale = phase === "intro" || phase === "outro" ? "scale-90 opacity-0" : "scale-100 opacity-100";

  return (
    <div className="fixed inset-0 z-[var(--z-bigwin)] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {config.tier !== "nice" && <SpawnParticles count={config.tier === "legendary" ? 80 : 40} color={tierConfig.color} />}
      <div className={`text-center transition-all duration-300 ${scale}`}>
        <div className="mb-4 text-6xl animate-bounce">{tierConfig.emoji}</div>
        <h1 className={`text-4xl font-black uppercase tracking-wider ${tierConfig.color} animate-pulse`}>
          {tierConfig.label}
        </h1>
        <div className="mt-4 text-5xl font-black text-white animate-count-up">
          +{formatWinAmount(config.profit)}
        </div>
        <div className="mt-2 text-2xl text-white/80">{config.multiplier.toFixed(2)}x</div>
        <div className="mt-4 text-sm text-white/50">{config.outcome}</div>
      </div>
    </div>
  );
}

export function BigWinTrigger({
  children,
  trigger,
}: {
  children: ReactNode;
  trigger: (show: (config: BigWinConfig) => void) => void;
}) {
  const [config, setConfig] = useState<BigWinConfig | null>(null);

  useEffect(() => {
    trigger(setConfig);
  }, [trigger]);

  return (
    <>
      {children}
      {config && <BigWinOverlay config={config} onDismiss={() => setConfig(null)} />}
    </>
  );
}

export function shouldShowBigWin(multiplier: number, profit: number): boolean {
  return multiplier >= 2 && profit > 0;
}
