"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";
import { SCATTER, WILD, type SymbolId, spinSlots5x5, type WaysWinInfo } from "./engine";

function SymbolIcon({ id }: { id: SymbolId }) {
  const title =
    id === WILD ? "Wild" : id === SCATTER ? "Scatter" : id[0]!.toUpperCase() + id.slice(1);
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 64 64"
      className="drop-shadow-[0_10px_25px_rgba(0,0,0,.35)]"
      aria-label={title}
    >
      <use href={`/slots5x5/symbols.svg#${id}`} />
    </svg>
  );
}

export default function Slots5x5Page() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();

  const [wager, setWager] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);

  const [grid, setGrid] = useState<SymbolId[][] | null>(null);
  const [waysWin, setWaysWin] = useState<WaysWinInfo | null>(null);
  const [last, setLast] = useState<{ profit: number; outcome: string; returnMult: number } | null>(
    null,
  );

  // Animation state (more "cabinet like"): each reel has its own strip and stop delay.
  const [reelStrip, setReelStrip] = useState<SymbolId[][]>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: 25 }, () => "cherry")),
  );
  const [reelStopIndex, setReelStopIndex] = useState<number[]>([0, 0, 0, 0, 0]);
  const baseIndexRef = useRef(0);

  const defaultGrid: SymbolId[][] = useMemo(
    () => [
      ["cherry", "lemon", "bell", "bar", "coin"],
      ["star", "bar", "lemon", "cherry", "diamond"],
      ["bell", "bar", "lemon", "coin", "seven"],
      ["bar", "lemon", "star", "cherry", "bell"],
      ["seven", "bar", "lemon", "cherry", "star"],
    ],
    [],
  );

  const visibleGrid = grid ?? defaultGrid;

  const buildRandomStrip = (rng: () => number): SymbolId[] => {
    const ids: SymbolId[] = ["cherry", "lemon", "bar", "bell", "star", "seven", "diamond", "coin"];
    const weights = new Map<SymbolId, number>([
      ["cherry", 26],
      ["lemon", 26],
      ["bar", 22],
      ["bell", 14],
      ["star", 10],
      ["seven", 6],
      ["diamond", 2],
      ["coin", 1.6],
    ]);
    const total = ids.reduce((a, s) => a + (weights.get(s) ?? 1), 0);
    const pick = () => {
      let x = rng() * total;
      for (const s of ids) {
        x -= weights.get(s) ?? 1;
        if (x <= 0) return s;
      }
      return "cherry";
    };
    return Array.from({ length: 30 }, pick);
  };

  const spin = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    if (balance < wager) return;

    setSpinning(true);
    setWaysWin(null);

    // Create a new spinning strip for each reel (client-side animation).
    const seed = Date.now() + Math.floor(Math.random() * 999999);
    const rng = () => {
      // tiny LCG for animation only
      // eslint-disable-next-line react-hooks/exhaustive-deps
      baseIndexRef.current = (baseIndexRef.current * 1664525 + 1013904223 + seed) >>> 0;
      return (baseIndexRef.current % 100000) / 100000;
    };
    const strips = Array.from({ length: 5 }, () => buildRandomStrip(rng));
    setReelStrip(strips);
    // spin further each reel and stagger stops
    setReelStopIndex([14, 16, 18, 20, 22]);

    const delay = turbo ? 650 : 1250;
    window.setTimeout(() => {
      const mode = freeSpinsLeft > 0 ? ("freespin" as const) : ("base" as const);
      const isFree = mode === "freespin";

      const bet = placeBet({
        game: isFree ? "Slots 5x5 (Free Spin)" : "Slots 5x5",
        wager,
        resolve: (rng2) => {
          const res = spinSlots5x5({
            rngFloat: rng2.float,
            mode,
            payoutScale: cfg.slotsPayoutScale ?? 1,
            extraChanceProbability: 0.13,
          });
          setGrid(res.grid);
          setWaysWin(res.waysBest);
          if (res.triggeredFreeSpins && freeSpinsLeft <= 0) setFreeSpinsLeft(5);
          else if (freeSpinsLeft > 0) setFreeSpinsLeft((n) => Math.max(0, n - 1));
          const multiplier = (isFree ? 1 : 0) + res.winMultiplier;
          const outcome = res.triggeredFreeSpins
            ? "FREE SPINS!"
            : res.winMultiplier > 0
              ? "WIN"
              : "LOSE";
          return { multiplier, outcome };
        },
      });

      const returnMult = wager > 0 ? (wager + bet.profit) / wager : 0;
      setLast({ profit: bet.profit, outcome: bet.outcome, returnMult });
      void reportResult({ game: "Slots 5x5", profit: bet.profit, wager, balance: bet.balanceAfter });

      setSpinning(false);
    }, delay);
  };

  // Compute overlay reel marker: first N reels contribute to ways win.
  const reelsActive = waysWin?.len ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Slots (5×5 Deluxe)</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          5×5 grid with smoother reel motion and CC0 icon art (no emojis).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-soft glass-shine rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Controls</p>
            <p className="text-xs text-white/60">
              Balance: <span className="font-mono">{balance.toFixed(2)}</span> ⓒ
            </p>
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

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/70">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={turbo} onChange={(e) => setTurbo(e.target.checked)} />
              Turbo
            </label>
            {freeSpinsLeft > 0 ? (
              <span className="text-emerald-200">
                Free spins left: <span className="font-mono">{freeSpinsLeft}</span>
              </span>
            ) : (
              <span className="text-white/50">Scatters: {SCATTER}×3 ⇒ 5 free spins</span>
            )}
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="mt-5 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          >
            {spinning ? "Spinning…" : freeSpinsLeft > 0 ? "Spin (Free)" : "Spin"}
          </button>

          {last ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-white/80">{last.outcome}</p>
              <p className="mt-1 text-xs text-white/60">
                Return: <span className="font-mono">{last.returnMult.toFixed(2)}x</span> • Profit{" "}
                <span className={`font-mono ${last.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  {last.profit >= 0 ? "+" : ""}
                  {last.profit.toFixed(2)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Reels</p>

          {/* Reel markers for ways */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full ${reelsActive > 0 && i < reelsActive ? "bg-emerald-400/70" : "bg-white/10"}`}
              />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, reel) => {
              const stop = reelStopIndex[reel] ?? 0;
              const strip = reelStrip[reel] ?? [];
              // show a 5-high window from the strip; during spin we just advance the start index.
              const windowSyms = strip.slice(stop, stop + 5);

              return (
                <div key={reel} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }, (_, row) => {
                      const sym = spinning ? (windowSyms[row] ?? "cherry") : (visibleGrid[reel]?.[row] ?? "cherry");
                      const highlight = !!waysWin?.matched?.[reel]?.[row];
                      return (
                        <div
                          key={row}
                          className={`glass-soft flex h-14 w-14 items-center justify-center rounded-2xl ${
                            spinning ? "animate-[slotBlur_0.22s_linear_infinite]" : ""
                          } ${!spinning && highlight ? "ring-2 ring-emerald-300/70" : ""}`}
                        >
                          <SymbolIcon id={sym} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {waysWin && waysWin.pay > 0 ? (
            <p className="mt-3 text-xs text-white/70">
              Ways: <span className="font-mono">{waysWin.ways}</span> • Best win:{" "}
              <span className="font-mono">{waysWin.len}</span> reels of{" "}
              <span className="font-mono">{waysWin.symbol}</span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-white/55">
              Wild: <span className="font-mono">{WILD}</span> • Scatter:{" "}
              <span className="font-mono">{SCATTER}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

