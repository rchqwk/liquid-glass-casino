"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";
import {
  SCATTER,
  WILD,
  type SymbolKey,
  type SpinMode,
  spinSlots243Ways,
} from "./slotEngine";

export default function SlotsPage() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();

  const [wager, setWager] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);

  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [pendingGamble, setPendingGamble] = useState<number | null>(null);
  const [lastGrid, setLastGrid] = useState<SymbolKey[][] | null>(null);
  const [lastWasFreeSpin, setLastWasFreeSpin] = useState(false);

  const [last, setLast] = useState<{
    profit: number;
    outcome: string;
    multiplier: number;
  } | null>(null);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const payInfo = useMemo(
    () => ({
      ways: 243,
      extraChanceProbability: 0.12,
    }),
    [],
  );

  const defaultGrid: SymbolKey[][] = useMemo(
    () => [
      ["🍒", "⭐", "🍋"],
      ["🍉", "🍇", "⭐"],
      ["🔔", "🍒", "🍋"],
      ["💎", "🍇", "🪙"],
      ["7", "🍒", "👑"],
    ],
    [],
  );

  const doSpin = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    if (pendingGamble != null) return;

    const mode: SpinMode = freeSpinsLeft > 0 ? "freespin" : "base";
    const isFree = mode === "freespin";

    // In this prototype, "free spins" still use the same wager, but we refund the stake via +1x base multiplier.
    if (balance < wager) {
      setAuto(false);
      return;
    }

    setSpinning(true);
    window.setTimeout(() => {
      let grid: SymbolKey[][] | null = null;
      let triggeredFreeSpins = false;

      const bet = placeBet({
        game: isFree ? "Slots (Free Spin)" : "Slots",
        wager,
        resolve: (rng) => {
          const spinRes = spinSlots243Ways({
            rngFloat: rng.float,
            mode,
            payoutScale: cfg.slotsPayoutScale ?? 1,
            extraChanceProbability: payInfo.extraChanceProbability,
          });
          grid = spinRes.grid;
          triggeredFreeSpins = spinRes.triggeredFreeSpins;
          const multiplier = (isFree ? 1 : 0) + spinRes.winMultiplier;
          return { multiplier, outcome: spinRes.outcome };
        },
      });

      setLast({
        profit: bet.profit,
        outcome: bet.outcome,
        multiplier: bet.multiplier,
      });
      setLastGrid(grid);
      setLastWasFreeSpin(isFree);
      void reportResult({ game: "Slots", profit: bet.profit, wager });

      // Free spins bookkeeping
      if (triggeredFreeSpins && freeSpinsLeft <= 0) {
        setFreeSpinsLeft(10);
      } else if (freeSpinsLeft > 0) {
        setFreeSpinsLeft((n) => Math.max(0, n - 1));
      }

      // Gamble offer only after a paid win (and only when not autoplaying).
      if (!autoRef.current && !isFree && bet.profit > 0) {
        setPendingGamble(bet.profit);
      } else {
        setPendingGamble(null);
      }

      setSpinning(false);
    }, 850);
  };

  useEffect(() => {
    if (!auto) return;
    if (spinning) return;
    if (pendingGamble != null) {
      // Autoplay auto-collects.
      setPendingGamble(null);
      return;
    }
    const id = window.setTimeout(() => {
      if (autoRef.current) doSpin();
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, spinning, wager, cfg.slotsPayoutScale, balance, pendingGamble, freeSpinsLeft]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Slots</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          5×3 slot with <span className="font-mono text-white/80">243</span> ways,{" "}
          <span className="text-base">{WILD}</span> wilds,{" "}
          <span className="text-base">{SCATTER}</span> scatters, free spins, extra chance, and gamble.
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

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/65">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Ways: <span className="font-mono text-white/80">{payInfo.ways}</span>
              </span>
              <span>
                Wild: <span className="text-base">{WILD}</span>
              </span>
              <span>
                Scatter: <span className="text-base">{SCATTER}</span> (3+ ⇒ Free Spins)
              </span>
              <span className="text-white/55">
                Extra chance: {Math.round(payInfo.extraChanceProbability * 100)}%
              </span>
            </div>
            {freeSpinsLeft > 0 ? (
              <div className="mt-2 text-emerald-200">
                Free spins left: <span className="font-mono">{freeSpinsLeft}</span>
              </div>
            ) : null}
          </div>

          <label className="mt-4 block text-xs text-white/60">Wager per spin (ⓒ)</label>
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
              disabled={spinning || auto || pendingGamble != null}
              onClick={doSpin}
            >
              {spinning ? "Spinning…" : freeSpinsLeft > 0 ? "Spin (Free)" : "Spin"}
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

          {pendingGamble != null ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-medium text-white/70">Gamble (double or nothing)</p>
              <p className="mt-1 text-xs text-white/60">
                Winnings:{" "}
                <span className="font-mono text-white/80">{pendingGamble.toFixed(2)}</span> ⓒ
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10"
                  onClick={() => setPendingGamble(null)}
                >
                  Collect
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25"
                  onClick={() => {
                    const amount = pendingGamble;
                    if (!amount || amount <= 0) return;
                    setPendingGamble(null);
                    const bet = placeBet({
                      game: "Slots Gamble",
                      wager: amount,
                      resolve: (rng) => {
                        const win = rng.float(0) < 0.5;
                        return {
                          multiplier: win ? 2 : 0,
                          outcome: win ? "Gamble WIN (x2)" : "Gamble LOSE (0)",
                        };
                      },
                    });
                    setLast({
                      profit: bet.profit,
                      outcome: bet.outcome,
                      multiplier: bet.multiplier,
                    });
                    void reportResult({ game: "Slots Gamble", profit: bet.profit, wager: amount });
                    if (bet.profit > 0) setPendingGamble(bet.profit);
                  }}
                >
                  Gamble (50/50)
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/55">
                Autoplay will always auto-collect (no gamble).
              </p>
            </div>
          ) : null}
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Result</p>

          <div className="mt-3 flex items-center justify-center">
            <div className="grid grid-cols-5 gap-2">
              {(lastGrid ?? defaultGrid).map((col, x) => (
                <div key={x} className="flex flex-col gap-2">
                  {col.map((s, y) => (
                    <div
                      key={`${x}-${y}`}
                      className={`glass-soft flex h-14 w-14 items-center justify-center rounded-3xl text-2xl ${
                        spinning ? "animate-[slotBlur_0.25s_linear_infinite]" : ""
                      }`}
                      title={s === WILD ? "Wild" : s === SCATTER ? "Scatter" : ""}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {!last ? (
            <p className="mt-4 text-sm text-white/60">Spin to play.</p>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-white/80">{last.outcome}</p>
              {lastWasFreeSpin ? (
                <p className="mt-1 text-xs text-emerald-200">Free spin (stake refunded)</p>
              ) : null}
              <p className="mt-2 text-xs text-white/60">
                Profit{" "}
                <span className={`font-mono ${last.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  {last.profit >= 0 ? "+" : ""}
                  {last.profit.toFixed(2)} ⓒ
                </span>
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 p-3">
            <p className="text-xs font-medium text-white/70">Features</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-5 text-white/55">
              <li>
                <span className="font-medium text-white/70">{WILD}</span> is wild (substitutes) and expands reels in free spins.
              </li>
              <li>
                <span className="font-medium text-white/70">{SCATTER}</span> ×3 triggers 10 free spins.
              </li>
              <li>
                Extra Chance: when you land exactly 2 scatters, it may upgrade into free spins.
              </li>
              <li>Gamble: after a paid win you can double-or-nothing (50/50).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
