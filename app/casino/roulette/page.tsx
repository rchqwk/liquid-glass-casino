"use client";

import { useMemo, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { ChipSelector } from "./ChipSelector";
import { RouletteBoard } from "./RouletteBoard";
import type { BetKey } from "./rouletteMath";
import { EUROPEAN_ORDER, colorOf, payoutMultiplierForKey } from "./rouletteMath";
import { RouletteWheel } from "./RouletteWheel";
import { useAuth } from "../../lib/authClient";

export default function RoulettePage() {
  const { balance, beginBet, settleBet } = useWallet();
  const { reportResult } = useAuth();
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Record<BetKey, number>>({} as any);

  const [spinning, setSpinning] = useState(false);
  const [wheelRotationDeg, setWheelRotationDeg] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const [recent, setRecent] = useState<
    { spun: number; color: "red" | "black" | "green"; ts: number }[]
  >([]);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [lastProfit, setLastProfit] = useState<number | null>(null);

  const totalStake = useMemo(
    () => Object.values(bets).reduce((a, b) => a + (Number(b) || 0), 0),
    [bets],
  );

  const clearBets = () => setBets({} as any);

  const addBet = (key: BetKey) => {
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }));
  };

  const computeWheelTargetRotation = (spun: number) => {
    const idx = EUROPEAN_ORDER.indexOf(spun);
    const pocketAngle = 360 / EUROPEAN_ORDER.length;
    const centerAngle = idx * pocketAngle + pocketAngle / 2;
    // We want the chosen pocket centered at the top (-90deg). Our SVG wheel is drawn with 0 at top offset.
    // Rotating wheel by (360 - centerAngle) will bring that pocket to the top.
    const toTop = 360 - centerAngle;
    const extraSpins = 360 * (4 + Math.floor(Math.random() * 2)); // 4–5 spins
    return wheelRotationDeg + extraSpins + toTop;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Roulette</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Tap the board to place chips, then spin the wheel. European order
          (0–36) with an animated wheel + ball landing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChipSelector value={chip} onChange={setChip} />
            <div className="glass-soft glass-shine rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Bet slip</p>
                <p className="text-xs text-white/60">
                  Balance: <span className="font-mono">{balance.toFixed(2)}</span> ⓒ
                </p>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/60">Total stake</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {totalStake.toFixed(2)} ⓒ
                </p>
                <p className="mt-2 text-[11px] leading-4 text-white/55">
                  Tip: click the same cell multiple times to stack chips.
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {/* Spin controls + wheel side-by-side on larger screens */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
                      disabled={spinning || totalStake <= 0}
                      onClick={() => {
                        if (spinning || totalStake <= 0) return;

                        // Reserve funds and lock RNG for this spin
                        const started = beginBet({
                          game: "Roulette",
                          wager: totalStake,
                        });
                        if ("error" in started) {
                          setLastOutcome(started.error);
                          setLastProfit(null);
                          return;
                        }

                        const nonce = started.nonce;
                        const rng = started.rng;

                        const spun = rng.int(0, 37);
                        const nextRot = computeWheelTargetRotation(spun);
                        setLanded(null);
                        setSpinning(true);
                        setWheelRotationDeg(nextRot);

                        // After the wheel finishes, "drop" ball onto number and settle bet.
                        window.setTimeout(() => {
                          setSpinning(false);
                          setLanded(spun);

                          const totalReturn = Object.entries(bets).reduce(
                            (acc, [k, amount]) => {
                              const stake = Number(amount) || 0;
                              if (stake <= 0) return acc;
                              const m = payoutMultiplierForKey(k as BetKey, spun);
                              return acc + stake * m;
                            },
                            0,
                          );

                          const multiplier =
                            totalStake > 0 ? totalReturn / totalStake : 0;
                          const outcome = `Spun ${spun} (${colorOf(spun)}). Return ${totalReturn.toFixed(2)} on stake ${totalStake.toFixed(2)}.`;
                          const settled = settleBet({ nonce, multiplier, outcome });
                          if (!("error" in settled)) {
                            setLastOutcome(settled.outcome);
                            setLastProfit(settled.profit);
                            setRecent((r) => [
                              { spun, color: colorOf(spun), ts: Date.now() },
                              ...r,
                            ].slice(0, 10));
                            void reportResult({
                              game: "Roulette",
                              profit: settled.profit,
                              wager: totalStake,
                            });
                          } else {
                            setLastOutcome(settled.error);
                            setLastProfit(null);
                          }
                        }, 3000);
                      }}
                    >
                      {spinning ? "Spinning…" : "Spin"}
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white disabled:opacity-40"
                      disabled={spinning}
                      onClick={clearBets}
                    >
                      Clear bets
                    </button>
                  </div>

                  {/* Wheel next to the spin button (desktop/tablet) */}
                  <div className="hidden sm:flex sm:shrink-0 sm:items-center sm:justify-center">
                    <RouletteWheel
                      spinning={spinning}
                      wheelRotationDeg={wheelRotationDeg}
                      landedNumber={landed}
                      showHeader={false}
                      size={220}
                    />
                  </div>
                </div>

                {/* Wheel below controls (mobile) */}
                <div className="sm:hidden">
                  <RouletteWheel
                    spinning={spinning}
                    wheelRotationDeg={wheelRotationDeg}
                    landedNumber={landed}
                    showHeader={false}
                    size={260}
                  />
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-white/70">Last result</p>
                <p className="mt-1 text-sm text-white/75">
                  {lastOutcome ?? "—"}
                </p>
                {lastProfit != null ? (
                  <p className="mt-2 text-xs text-white/60">
                    Profit{" "}
                    <span
                      className={`font-mono ${lastProfit >= 0 ? "text-emerald-200" : "text-rose-200"}`}
                    >
                      {lastProfit >= 0 ? "+" : ""}
                      {lastProfit.toFixed(2)} ⓒ
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 p-3">
                <p className="text-xs font-medium text-white/70">Recent</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recent.length === 0 ? (
                    <span className="text-xs text-white/55">No spins yet.</span>
                  ) : (
                    recent.map((s) => (
                      <span
                        key={s.ts}
                        className={`rounded-xl px-2 py-1 text-xs font-medium ${
                          s.color === "red"
                            ? "bg-rose-500/30 text-rose-100"
                            : s.color === "black"
                              ? "bg-white/10 text-white/80"
                              : "bg-emerald-500/25 text-emerald-100"
                        }`}
                      >
                        {s.spun}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <RouletteBoard bets={bets} onAddBet={addBet} />
        </div>
      </div>
    </div>
  );
}
