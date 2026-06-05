"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatChips } from "../lib/format";

type BigWinDetail = {
  game: string;
  wager: number;
  profit: number;
  returnMult: number; // (wager+profit)/wager
  ts: number;
};

function formatNumber(n: number) {
  return formatChips(n);
}

const MILESTONES = [
  { x: 20, label: "BIG WIN" },
  { x: 30, label: "MASSIVE WIN" },
  { x: 50, label: "MEGA WIN" },
  { x: 100, label: "ULTRA WIN" },
  { x: 200, label: "LEGENDARY WIN" },
  { x: 500, label: "GODLIKE WIN" },
  { x: 1000, label: "INSANE WIN" },
  { x: 2000, label: "COSMIC WIN" },
  { x: 5000, label: "UNREAL WIN" },
  { x: 10000, label: "10,000x WIN" },
];

function labelFor(x: number) {
  let label = "BIG WIN";
  for (const m of MILESTONES) {
    if (x >= m.x) label = m.label;
  }
  return label;
}

function durationFor(x: number) {
  // Higher win => slower buildup. Cap to keep it sane.
  const base = 1400;
  const extra = Math.min(11000, Math.max(0, (x - 20) * 35));
  // compress very high values with log scaling
  const logExtra = Math.min(9000, Math.log10(Math.max(20, x)) * 1800);
  return Math.min(14000, base + Math.max(extra, logExtra));
}

export function BigWinOverlay() {
  const [active, setActive] = useState<BigWinDetail | null>(null);
  const [shownProfit, setShownProfit] = useState(0);
  const [shownX, setShownX] = useState(0);
  const [shownLabel, setShownLabel] = useState<string | null>(null);
  const [centerMode, setCenterMode] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const targetProfit = active?.profit ?? 0;
  const targetX = active?.returnMult ?? 0;
  const title = useMemo(() => (active ? labelFor(active.returnMult) : null), [active]);

  // Clear on any next spin
  useEffect(() => {
    const onStart = () => {
      setActive(null);
      setShownProfit(0);
      setShownX(0);
      setShownLabel(null);
      setCenterMode(false);
    };
    window.addEventListener("lgc:betstart", onStart as any);
    return () => window.removeEventListener("lgc:betstart", onStart as any);
  }, []);

  useEffect(() => {
    const onBigWin = (e: Event) => {
      const detail = (e as CustomEvent).detail as BigWinDetail;
      setActive(detail);
      setShownProfit(0);
      setShownX(0);
      setShownLabel(labelFor(20));
      setCenterMode(detail.returnMult >= 50); // mega+ gets center alert
      startedAtRef.current = performance.now();
    };
    window.addEventListener("lgc:bigwin", onBigWin as any);
    return () => window.removeEventListener("lgc:bigwin", onBigWin as any);
  }, []);

  useEffect(() => {
    if (!active) return;

    const dur = durationFor(active.returnMult);
    const fromProfit = 0;
    const fromX = 0;
    const toProfit = targetProfit;
    const toX = targetX;

    const tick = () => {
      const t = Math.min(1, (performance.now() - startedAtRef.current) / dur);
      // easing
      const ease = 1 - Math.pow(1 - t, 3);

      const curProfit = fromProfit + (toProfit - fromProfit) * ease;
      const curX = fromX + (toX - fromX) * ease;
      setShownProfit(curProfit);
      setShownX(curX);

      // Update label when crossing milestones
      setShownLabel(labelFor(curX));

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        // If it's not a mega+ win, fade out after a moment.
        if (active.returnMult < 50) {
          window.setTimeout(() => {
            setActive(null);
            setCenterMode(false);
          }, 1200);
        }
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Mild top banner always */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 flex justify-center px-4">
        <div className="bigwin-banner glass-soft rounded-2xl border border-white/10 px-4 py-2 text-center text-xs text-white/85">
          <span className="font-semibold">{shownLabel ?? title}</span>{" "}
          <span className="text-white/55">•</span>{" "}
          <span className="font-mono">{shownX.toFixed(2)}x</span>{" "}
          <span className="text-white/55">•</span>{" "}
          <span className="font-mono">+{formatNumber(shownProfit)} ⓒ</span>
        </div>
      </div>

      {/* Center alert for mega+ that stays until higher level or next spin */}
      {centerMode ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="bigwin-center glass glass-shine w-full max-w-md rounded-3xl border border-white/15 p-6 text-center">
            <div className="bigwin-title text-2xl font-bold tracking-wide text-white">
              {shownLabel ?? title}
            </div>
            <div className="mt-2 text-sm text-white/70">{active.game}</div>
            <div className="mt-4 text-5xl font-extrabold text-white">
              <span className="font-mono">{shownX.toFixed(2)}x</span>
            </div>
            <div className="mt-2 text-lg text-white/85">
              <span className="font-mono">+{formatNumber(shownProfit)} ⓒ</span>
            </div>
            <div className="mt-4 text-[11px] text-white/55">
              (Holds until a higher milestone or your next spin)
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
