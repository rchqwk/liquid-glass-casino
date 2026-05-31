"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";

type SymbolKey =
  | "🍒"
  | "🍋"
  | "🍇"
  | "🍉"
  | "⭐"
  | "🔔"
  | "💎" // wild
  | "👑"
  | "7"
  | "🪙"; // scatter/bonus

const WILD = "💎" as const;
const SCATTER = "🪙" as const;
type Wild = typeof WILD;
type Scatter = typeof SCATTER;

const SYMBOLS: { s: SymbolKey; w: number }[] = [
  { s: "🍒", w: 22 },
  { s: "🍋", w: 22 },
  { s: "🍇", w: 18 },
  { s: "🍉", w: 16 },
  { s: "⭐", w: 10 },
  { s: "🔔", w: 8 },
  { s: "💎", w: 5 },
  { s: "👑", w: 4 },
  { s: "🪙", w: 3 },
  { s: "7", w: 2 },
];

// Higher ceiling (bigger jackpots) + smaller wins for 2-of-kind.
const PAY_3: Record<Exclude<SymbolKey, Scatter>, number> = {
  "🍒": 6,
  "🍋": 6,
  "🍇": 8,
  "🍉": 10,
  "⭐": 14,
  "🔔": 20,
  "💎": 30, // 3 wilds
  "👑": 60,
  "7": 120, // highest ceiling
};

const PAY_2: Record<Exclude<SymbolKey, Scatter>, number> = {
  "🍒": 1.2,
  "🍋": 1.2,
  "🍇": 1.4,
  "🍉": 1.6,
  "⭐": 2,
  "🔔": 2.5,
  "💎": 3,
  "👑": 6,
  "7": 12,
};

const SCATTER_3_PAYOUT = 15; // bonus if 3 scatters appear

export default function SlotsPage() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();
  const [wager, setWager] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const [last, setLast] = useState<{
    reels: [SymbolKey, SymbolKey, SymbolKey];
    profit: number;
    outcome: string;
    multiplier: number;
  } | null>(null);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const weightedPick = (r01: number): SymbolKey => {
    const total = SYMBOLS.reduce((a, b) => a + b.w, 0);
    let x = r01 * total;
    for (const it of SYMBOLS) {
      x -= it.w;
      if (x <= 0) return it.s;
    }
    return SYMBOLS[0]!.s;
  };

  const evaluate = (reels: [SymbolKey, SymbolKey, SymbolKey]) => {
    const scale = Math.min(10, Math.max(0.1, cfg.slotsPayoutScale ?? 1));
    const scatterCount = reels.filter((s) => s === SCATTER).length;
    if (scatterCount === 3) {
      return {
        multiplier: SCATTER_3_PAYOUT * scale,
        outcome: `Reels ${reels.join("")} BONUS ${(SCATTER_3_PAYOUT * scale).toFixed(2)}x`,
      };
    }

    // Find best 3-of-kind / 2-of-kind considering WILD substitution.
    const candidates = Object.keys(PAY_3) as Exclude<SymbolKey, Scatter>[];
    let bestMatch = 0;
    let bestSym: Exclude<SymbolKey, Scatter> = "🍒";

    for (const sym of candidates) {
      const matchCount = reels.filter((r) => r === sym || r === WILD).length;
      if (matchCount > bestMatch) {
        bestMatch = matchCount;
        bestSym = sym;
      }
    }

    if (bestMatch >= 3) {
      const m = PAY_3[bestSym] * scale;
      return { multiplier: m, outcome: `Reels ${reels.join("")} WIN ${m.toFixed(2)}x` };
    }
    if (bestMatch === 2) {
      const m = PAY_2[bestSym] * scale;
      return { multiplier: m, outcome: `Reels ${reels.join("")} WIN ${m.toFixed(2)}x` };
    }

    return { multiplier: 0, outcome: `Reels ${reels.join("")} LOSE` };
  };

  const paytableRows = useMemo(
    () =>
      (Object.keys(PAY_3) as Exclude<SymbolKey, Scatter>[]).map((k) => ({
        k,
        v3: PAY_3[k],
        v2: PAY_2[k],
      })),
    [],
  );

  const spinOnce = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    if (balance < wager) {
      setAuto(false);
      return;
    }

    setSpinning(true);

    // A little “spin” delay for animation feel
    setTimeout(() => {
      let reels: [SymbolKey, SymbolKey, SymbolKey] = ["🍒", "🍒", "🍒"];

      const bet = placeBet({
        game: "Slots",
        wager,
        resolve: (rng) => {
          // Weighted reels using deterministic floats
          const a = weightedPick(rng.float(0));
          const b = weightedPick(rng.float(1));
          const c = weightedPick(rng.float(2));
          reels = [a, b, c];
          const res = evaluate(reels);
          return res;
        },
      });

      setLast({
        reels,
        profit: bet.profit,
        outcome: bet.outcome,
        multiplier: bet.multiplier,
      });
      void reportResult({ game: "Slots", profit: bet.profit, wager });
      setSpinning(false);

      // Stop autoplay if we can’t keep betting.
      if (autoRef.current && balance - wager < 0) setAuto(false);
    }, 850);
  };

  useEffect(() => {
    if (!auto) return;
    if (spinning) return;
    const id = window.setTimeout(() => {
      if (autoRef.current) spinOnce();
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, spinning, wager, cfg.slotsPayoutScale, balance]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Slots</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Simple 3-reel slot. Win when all 3 symbols match.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-soft glass-shine rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Spin</p>
            <p className="text-xs text-white/60">
              Balance: <span className="font-mono">{balance.toFixed(2)}</span> ⓒ
            </p>
          </div>

          <label className="mt-4 block text-xs text-white/60">Wager (ⓒ)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={wager}
            onChange={(e) => setWager(Number(e.target.value))}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
              type="button"
              disabled={spinning || auto}
              onClick={spinOnce}
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
            <button
              className="rounded-2xl px-4 py-2 text-sm font-medium text-white/75 transition hover:text-white disabled:opacity-40"
              type="button"
              disabled={spinning && !auto}
              onClick={() => setAuto((a) => !a)}
            >
              {auto ? "Stop autoplay" : "Autoplay"}
            </button>
          </div>
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Result</p>

          <div className="mt-3 flex items-center justify-center gap-2">
            {(last?.reels ?? ["🍒", "⭐", "🍋"]).map((s, i) => (
              <div
                key={i}
                className={`glass-soft flex h-16 w-16 items-center justify-center rounded-3xl text-3xl ${
                  spinning ? "animate-[slotBlur_0.25s_linear_infinite]" : ""
                }`}
              >
                {s}
              </div>
            ))}
          </div>

          {!last ? (
            <p className="mt-4 text-sm text-white/60">Spin to play.</p>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-white/80">{last.outcome}</p>
              <p className="mt-2 text-xs text-white/60">
                Profit{" "}
                <span
                  className={`font-mono ${last.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}
                >
                  {last.profit >= 0 ? "+" : ""}
                  {last.profit.toFixed(2)} ⓒ
                </span>
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 p-3">
            <p className="text-xs font-medium text-white/70">Paytable</p>
            <p className="mt-2 text-[11px] leading-4 text-white/55">
              3-of-kind pays high (higher ceiling). 2-of-kind pays small.
              {` `}
              <span className="font-medium text-white/70">{WILD}</span> is wild.
              {` `}
              <span className="font-medium text-white/70">{SCATTER}</span> ×3 pays{" "}
              <span className="font-mono text-white/70">{SCATTER_3_PAYOUT}x</span>.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
              {paytableRows.map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-2 py-1.5"
                >
                  <span className="text-base">{r.k}</span>
                  <span className="font-mono">
                    {r.v2}x / {r.v3}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
