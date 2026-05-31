"use client";

import { useMemo, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";

export default function DicePage() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();
  const [wager, setWager] = useState(10);
  const [target, setTarget] = useState(49.5);
  const [rolling, setRolling] = useState(false);
  const [last, setLast] = useState<{
    roll: number;
    profit: number;
    multiplier: number;
    outcome: string;
  } | null>(null);

  const houseEdge = Math.max(0, Math.min(0.1, cfg.diceHouseEdge ?? 0.01));
  const clampedTarget = useMemo(() => Math.min(98, Math.max(2, target)), [target]);
  const winMultiplier = useMemo(
    () => (100 * (1 - houseEdge)) / clampedTarget,
    [clampedTarget],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Dice</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Roll a number in <span className="font-mono">[0, 100)</span>. Win if
          roll &lt; target.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-soft glass-shine rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Bet</p>
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

          <label className="mt-4 block text-xs text-white/60">
            Target: {clampedTarget.toFixed(2)}
          </label>
          <input
            type="range"
            min={2}
            max={98}
            step={0.1}
            value={clampedTarget}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-2 w-full"
          />

          <div className="mt-4 flex items-center justify-between text-xs text-white/60">
            <span>
              Win multiplier:{" "}
              <span className="font-mono text-white/80">
                {winMultiplier.toFixed(4)}x
              </span>
            </span>
            <span>House edge: 1%</span>
          </div>

          <button
            className="mt-5 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            type="button"
            onClick={() => {
              if (rolling) return;
              setRolling(true);
              setTimeout(() => {
                const bet = placeBet({
                  game: "Dice",
                  wager,
                  resolve: (rng) => {
                    const roll = rng.float(0) * 100;
                    const win = roll < clampedTarget;
                    const multiplier = win ? winMultiplier : 0;
                    return {
                      multiplier,
                      outcome: `Roll ${roll.toFixed(2)} ${win ? "<" : "≥"} ${clampedTarget.toFixed(2)}`,
                    };
                  },
                });

                const m = bet.outcome.match(/Roll ([0-9.]+)/);
                const roll = m ? Number(m[1]) : NaN;
                setLast({
                  roll,
                  profit: bet.profit,
                  multiplier: bet.multiplier,
                  outcome: bet.outcome,
                });
                void reportResult({
                  game: "Dice",
                  profit: bet.profit,
                  wager,
                  balance: bet.balanceAfter,
                });
                setRolling(false);
              }, 650);
            }}
          >
            {rolling ? "Rolling…" : "Roll"}
          </button>
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Last result</p>

          {!last ? (
            <p className="mt-3 text-sm text-white/60">
              Place a bet to see results.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <div className="glass-soft relative h-3 overflow-hidden rounded-full">
                <div
                  className={`absolute inset-y-0 left-0 ${rolling ? "animate-pulse" : ""}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, last.roll))}%`,
                    background:
                      "linear-gradient(90deg, rgba(59,130,246,.75), rgba(168,85,247,.75))",
                  }}
                />
              </div>
              <p className="text-sm text-white/80">{last.outcome}</p>
              <p className="text-xs text-white/60">
                Multiplier:{" "}
                <span className="font-mono text-white/80">
                  {last.multiplier.toFixed(4)}x
                </span>
              </p>
              <p className="text-xs text-white/60">
                Profit:{" "}
                <span
                  className={`font-mono ${last.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}
                >
                  {last.profit >= 0 ? "+" : ""}
                  {last.profit.toFixed(2)} ⓒ
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
