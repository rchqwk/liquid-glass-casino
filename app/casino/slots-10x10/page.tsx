"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";
import { SCATTER, WILD, type SymbolId, spinCluster10x10, type CascadeStep } from "./engine";
import { Slots5x5Sprite } from "../slots-5x5/Sprite";

function SymbolIcon({ id }: { id: SymbolId }) {
  return (
    <svg width="24" height="24" viewBox="0 0 64 64" className="pointer-events-none">
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

export default function Slots10x10Page() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();

  const [wager, setWager] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [luckySpin, setLuckySpin] = useState(false);

  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [featureTier, setFeatureTier] = useState<0 | 1 | 2>(0); // 0 base, 1 normal, 2 super

  const [grid, setGrid] = useState<SymbolId[][] | null>(null); // [x][y]
  const [steps, setSteps] = useState<CascadeStep[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [last, setLast] = useState<{ profit: number; returnMult: number; outcome: string } | null>(null);
  const [lastScatterCount, setLastScatterCount] = useState(0);
  const [animProfile, setAnimProfile] = useState<"normal" | "near" | "big">("normal");

  const defaultGrid: SymbolId[][] = useMemo(
    () =>
      Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ((x + y) % 2 === 0 ? "cherry" : "lemon")),
      ),
    [],
  );

  const viewGrid = grid ?? defaultGrid;

  // animate cascade steps
  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setStepIdx(0);
    const msBase = turbo ? 220 : 320;
    const ms =
      animProfile === "big" ? msBase + (turbo ? 140 : 280) : animProfile === "near" ? msBase + (turbo ? 90 : 180) : msBase;
    const id = window.setInterval(() => {
      setStepIdx((i) => {
        const n = i + 1;
        if (n >= steps.length) {
          window.clearInterval(id);
          return i;
        }
        return n;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [steps, turbo, animProfile]);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    if (stepIdx < steps.length - 1) return;
    const id = window.setTimeout(() => setSteps(null), 900);
    return () => window.clearTimeout(id);
  }, [steps, stepIdx]);

  const spinOnce = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    const mode = freeSpinsLeft > 0 ? ("freespin" as const) : ("base" as const);
    const isFree = mode === "freespin";
    const cost = wager * (luckySpin && !isFree ? 1.5 : 1);
    if (balance < cost) return;

    setSpinning(true);

    let capturedScatter = 0;
    let capturedWinMult = 0;
    let capturedSteps: CascadeStep[] = [];

    const bet = placeBet({
      game: isFree ? "Slots 10x10 (Free Spin)" : luckySpin ? "Slots 10x10 (Lucky)" : "Slots 10x10",
      wager: cost,
      resolve: (rng) => {
        const res = spinCluster10x10({
          rngFloat: rng.float,
          mode,
          payoutScale: cfg.slotsPayoutScale ?? 1,
          minCluster: 6,
          featureTier,
          lucky:
            luckySpin && !isFree
              ? { scatterWeightMultiplier: 1.25, ensureMinScatters: 2, extraWildChance: 0.25 }
              : undefined,
        });
        capturedScatter = res.scatterCount;
        capturedWinMult = res.winMultiplier;
        capturedSteps = res.steps;

        // Feature trigger based on scatters count (3–4 normal, 5+ super)
        if (!isFree) {
          if (res.scatterCount >= 5) {
            setFeatureTier(2);
            setFreeSpinsLeft(15);
          } else if (res.scatterCount >= 3) {
            setFeatureTier(1);
            setFreeSpinsLeft(8);
          }
        } else {
          setFreeSpinsLeft((n) => Math.max(0, n - 1));
          if (freeSpinsLeft - 1 <= 0) setFeatureTier(0);
        }

        setGrid(res.finalGrid);
        setSteps(res.steps);

        const multiplier = (isFree ? 1 : 0) + res.winMultiplier; // refund stake in free spins
        const outcome =
          res.winMultiplier > 0 ? `WIN +${res.winMultiplier.toFixed(2)}x` : "LOSE";
        return { multiplier, outcome };
      },
    });

    const returnMult = cost > 0 ? (cost + bet.profit) / cost : 0;
    setLast({ profit: bet.profit, returnMult, outcome: bet.outcome });
    setLastScatterCount(capturedScatter);

    // Slow down cascades when it's exciting: big win or near miss.
    const isBig = returnMult >= 10 || capturedWinMult >= 10 || (capturedSteps?.length ?? 0) >= 8;
    const isNear =
      !isFree && !isBig && (capturedScatter === 4 || capturedScatter === 2);
    setAnimProfile(isBig ? "big" : isNear ? "near" : "normal");

    void reportResult({
      game: isFree ? "Slots 10x10" : luckySpin ? "Slots 10x10 (Lucky)" : "Slots 10x10",
      profit: bet.profit,
      wager: cost,
      balance: bet.balanceAfter,
    });

    window.setTimeout(() => setSpinning(false), turbo ? 520 : 900);
  };

  const activeStep = useMemo(() => {
    if (!steps || steps.length === 0) return null;
    return steps[Math.min(stepIdx, steps.length - 1)]!;
  }, [steps, stepIdx]);

  const brokenSet = useMemo(() => {
    const set = new Set<string>();
    if (!activeStep) return set;
    for (const c of activeStep.clusters ?? []) {
      for (const cell of c.cells) set.add(`${cell.x},${cell.y}`);
    }
    return set;
  }, [activeStep]);

  const brokenCount = useMemo(() => brokenSet.size, [brokenSet]);

  const displayGrid: (SymbolId | null)[][] = useMemo(() => {
    if (!activeStep) return viewGrid as any;
    return activeStep.grid;
  }, [activeStep, viewGrid]);

  return (
    <div className="flex flex-col gap-4">
      <Slots5x5Sprite />

      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Slots (10×10 Cascading)</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Cluster pays: any group of <span className="font-mono text-white/80">6+</span> breaks, pays,
          then symbols fall and can chain.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
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
            disabled={spinning || freeSpinsLeft > 0}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={turbo} onChange={(e) => setTurbo(e.target.checked)} />
              Turbo
            </label>
            <button
              type="button"
              className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                luckySpin ? "bg-amber-500/20 text-amber-100" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
              onClick={() => setLuckySpin((v) => !v)}
              disabled={spinning || freeSpinsLeft > 0}
              title="Lucky Spin costs +50% bet and boosts scatters + adds a wild chance"
            >
              {luckySpin ? "Lucky Spin ON (+50%)" : "Lucky Spin"}
            </button>
            {freeSpinsLeft > 0 ? (
              <span className="text-emerald-200">
                Free spins: <span className="font-mono">{freeSpinsLeft}</span>{" "}
                {featureTier === 2 ? "(SUPER)" : featureTier === 1 ? "(NORMAL)" : ""}
              </span>
            ) : (
              <span className="text-white/50">Scatters: 3–4 normal, 5+ super</span>
            )}
          </div>

          <button
            type="button"
            onClick={spinOnce}
            disabled={spinning}
            className="mt-5 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          >
            {spinning ? "Spinning…" : freeSpinsLeft > 0 ? "Spin (Free)" : "Spin"}
          </button>

          <button
            type="button"
            className="mt-2 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
            disabled={spinning || freeSpinsLeft > 0 || balance < wager * 100}
            onClick={() => {
              if (spinning) return;
              if (balance < wager * 100) return;
              const buy = placeBet({
                game: "Slots 10x10 Buy Feature",
                wager: wager * 100,
                resolve: () => ({ multiplier: 0, outcome: "Bought Free Spins" }),
              });
              setLast({ profit: buy.profit, returnMult: 0, outcome: "Bought Free Spins (100× bet)" });
              setFeatureTier(1);
              setFreeSpinsLeft(8);
              void reportResult({
                game: "Slots 10x10 Buy Feature",
                profit: buy.profit,
                wager: wager * 100,
                balance: buy.balanceAfter,
              });
            }}
            title="Pay 100× bet to start Normal Free Spins"
          >
            Buy Free Spins (100×)
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] leading-5 text-white/55">
            Base spins have lower return; big payouts come from chaining in Free Spins.
          </div>
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Board</p>
          {steps && steps.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/65">
              <span>
                Cascade: <span className="font-mono text-white/80">{stepIdx + 1}</span>/
                <span className="font-mono text-white/80">{steps.length}</span>
              </span>
              <span className="text-white/40">•</span>
              <span>
                Broken: <span className="font-mono text-white/80">{brokenCount}</span>
              </span>
              {animProfile !== "normal" ? (
                <>
                  <span className="text-white/40">•</span>
                  <span className={animProfile === "big" ? "text-amber-200" : "text-white/70"}>
                    {animProfile === "big" ? "BIG MOMENT" : "NEAR MISS"}
                  </span>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-xs text-white/55">
              Last scatters: <span className="font-mono">{lastScatterCount}</span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, y) =>
              Array.from({ length: 10 }, (_, x) => {
                const v = displayGrid[x]![y] ?? null;
                const broken = brokenSet.has(`${x},${y}`);
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`glass-soft relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl ${
                      v == null ? "opacity-30" : "opacity-100"
                    } ${spinning ? "animate-[slotBlur_0.22s_linear_infinite]" : ""} ${
                      broken ? "animate-[clusterShake_0.22s_linear_infinite]" : ""
                    }`}
                    title={v ?? "empty"}
                  >
                    {v ? <SymbolIcon id={v} /> : null}
                    {/* Break pop effect on broken cells */}
                    {broken ? (
                      <div className="pointer-events-none absolute inset-0 animate-[clusterPop_520ms_ease-out_1] rounded-xl bg-emerald-300/35" />
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
          <p className="mt-3 text-xs text-white/55">
            Wild: <span className="font-mono">{WILD}</span> • Scatter: <span className="font-mono">{SCATTER}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
