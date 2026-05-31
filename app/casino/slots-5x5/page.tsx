"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";
import { useGameConfig } from "../../lib/gameConfigClient";
import { SCATTER, WILD, type SymbolId, spinSlots5x5, type WaysWinInfo } from "./engine";
import { Slots5x5Sprite } from "./Sprite";

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
      {/* Inline sprite for Safari; xlinkHref for older Safari */}
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

function ReelColumn(props: {
  reelIndex: number;
  strip: SymbolId[];
  stopAtIndex: number | null;
  spinning: boolean;
  stopRequested: boolean;
  turbo: boolean;
  onStopped: () => void;
}) {
  const { reelIndex, strip, stopAtIndex, spinning, stopRequested, turbo, onStopped } = props;

  const CELL_PX = 56; // matches h-14
  const REPEAT = 4; // keep DOM light for mobile Safari
  const totalPx = strip.length * CELL_PX;

  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef<number>(totalPx * 2); // start in the middle block
  const stoppedRef = useRef(false);

  const repeated = useMemo(() => {
    const out: SymbolId[] = [];
    for (let i = 0; i < REPEAT; i += 1) out.push(...strip);
    return out;
  }, [strip]);

  // Ensure we render immediately (avoid brief blank frames on some browsers)
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.transform = `translateY(-${offsetRef.current}px)`;
  }, [strip]);

  // Spin loop (continuous motion)
  useEffect(() => {
    if (!spinning || stopRequested) return;
    const el = innerRef.current;
    if (!el) return;

    stoppedRef.current = false;
    el.style.transition = "none";

    // px per frame (roughly); faster on turbo
    const speed = turbo ? 42 : 24;

    const tick = () => {
      offsetRef.current += speed;
      // keep offset within a safe middle range so we can still "coast" to the stop target
      const max = totalPx * 4;
      const min = totalPx * 2;
      if (offsetRef.current > max) offsetRef.current -= totalPx * 2;
      if (offsetRef.current < min) offsetRef.current += totalPx * 2;

      el.style.transform = `translateY(-${offsetRef.current}px)`;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [spinning, stopRequested, turbo, totalPx]);

  // Stop animation (inertia + stagger)
  useEffect(() => {
    if (!spinning || !stopRequested) return;
    if (stopAtIndex == null) return;
    const el = innerRef.current;
    if (!el) return;

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const cur = offsetRef.current;
    const curMod = ((cur % totalPx) + totalPx) % totalPx;
    const targetMod = stopAtIndex * CELL_PX;
    const delta = (targetMod - curMod + totalPx) % totalPx;

    // extra full rotations for realism (more on non-turbo) + per-reel stagger
    const extraRot = turbo ? 2 : 4;
    const target = cur + delta + totalPx * extraRot + reelIndex * CELL_PX * 2;
    offsetRef.current = target;

    const duration = (turbo ? 650 : 1200) + reelIndex * (turbo ? 110 : 170);
    el.style.transition = `transform ${duration}ms cubic-bezier(.12,.86,.2,1)`;
    el.style.transform = `translateY(-${target}px)`;

    const finish = () => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      el.style.transition = "none";
      onStopped();
    };
    const timeout = window.setTimeout(finish, duration + 80);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      window.clearTimeout(timeout);
      el.removeEventListener("transitionend", onEnd);
      finish();
    };
    el.addEventListener("transitionend", onEnd);

    return () => {
      window.clearTimeout(timeout);
      el.removeEventListener("transitionend", onEnd);
    };
  }, [spinning, stopRequested, stopAtIndex, turbo, reelIndex, totalPx]);

  return (
    <div className="relative h-[280px] w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div ref={innerRef} className="will-change-transform">
        {repeated.map((sym, idx) => (
          <div
            key={idx}
            className="flex h-14 w-14 items-center justify-center border-b border-white/5"
          >
            <SymbolIcon id={sym} />
          </div>
        ))}
      </div>
      {/* subtle vignette / glass */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,.06),inset_0_20px_40px_rgba(0,0,0,.35),inset_0_-20px_40px_rgba(0,0,0,.35)]" />
    </div>
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
  const [luckySpin, setLuckySpin] = useState(false);
  const [fsTier, setFsTier] = useState<"normal" | "super">("normal");

  const [grid, setGrid] = useState<SymbolId[][] | null>(null);
  const [waysWin, setWaysWin] = useState<WaysWinInfo | null>(null);
  const [last, setLast] = useState<{ profit: number; outcome: string; returnMult: number } | null>(
    null,
  );

  // Reel animation state (true reel-strip motion).
  const [spinId, setSpinId] = useState(0);
  const STRIP_LEN = 24;
  const TAIL_LEN = 8;
  const [reelStrip, setReelStrip] = useState<SymbolId[][]>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: STRIP_LEN }, () => "cherry")),
  );
  const [stopAt, setStopAt] = useState<number[] | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const stoppedCountRef = useRef(0);
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

  const buildRandomStrip = (rng: () => number, len: number): SymbolId[] => {
    const ids: SymbolId[] = ["cherry", "lemon", "bar", "bell", "star", "seven", "diamond", "coin"];
    const weights = new Map<SymbolId, number>([
      ["cherry", 39],
      ["lemon", 39],
      ["bar", 33],
      ["bell", 12],
      ["star", 8],
      ["seven", 5],
      ["diamond", 1.6],
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
    return Array.from({ length: len }, pick);
  };

  const spin = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    const cost = wager * (luckySpin && freeSpinsLeft <= 0 ? 1.5 : 1);
    if (balance < cost) return;

    setSpinning(true);
    setWaysWin(null);
    setStopRequested(false);
    setStopAt(null);
    setSpinId((x) => x + 1);
    stoppedCountRef.current = 0;

    // Create a new spinning strip for each reel (client-side animation).
    const seed = Date.now() + Math.floor(Math.random() * 999999);
    const rng = () => {
      // tiny LCG for animation only
      // eslint-disable-next-line react-hooks/exhaustive-deps
      baseIndexRef.current = (baseIndexRef.current * 1664525 + 1013904223 + seed) >>> 0;
      return (baseIndexRef.current % 100000) / 100000;
    };
    const strips = Array.from({ length: 5 }, () => buildRandomStrip(rng, STRIP_LEN));
    setReelStrip(strips);

    const delay = turbo ? 600 : 1050;
    window.setTimeout(() => {
      const mode = freeSpinsLeft > 0 ? ("freespin" as const) : ("base" as const);
      const isFree = mode === "freespin";
      const tierScale = isFree && fsTier === "super" ? 1.8 : 1;

      let resGrid: SymbolId[][] | null = null;
      let resWays: WaysWinInfo | null = null;
      let resTriggeredFS = false;

      const bet = placeBet({
        game: isFree ? "Slots 5x5 (Free Spin)" : "Slots 5x5",
        wager: cost,
        resolve: (rng2) => {
          const res = spinSlots5x5({
            rngFloat: rng2.float,
            mode,
            payoutScale: (cfg.slotsPayoutScale ?? 1) * tierScale,
            extraChanceProbability: isFree && fsTier === "super" ? 0.18 : 0.13,
            lucky:
              luckySpin && !isFree
                ? { scatterWeightMultiplier: 1.25, ensureMinScatters: 2, extraWildChance: 0.25 }
                : undefined,
          });
          resGrid = res.grid;
          resWays = res.waysBest;
          resTriggeredFS = res.triggeredFreeSpins;
          const multiplier = (isFree ? 1 : 0) + res.winMultiplier;
          const outcome = res.triggeredFreeSpins
            ? "FREE SPINS!"
            : res.winMultiplier > 0
              ? "WIN"
              : "LOSE";
          return { multiplier, outcome };
        },
      });

      if (resGrid) {
        setGrid(resGrid);
        setWaysWin(resWays);
        if (resTriggeredFS && freeSpinsLeft <= 0) {
          setFsTier("normal");
          setFreeSpinsLeft(5);
        }
        else if (freeSpinsLeft > 0) setFreeSpinsLeft((n) => Math.max(0, n - 1));

        // Append the final 5-symbol window to each reel strip so we can stop on it.
        setReelStrip((prev) =>
          prev.map((s, i) => {
            const head = s.slice(0, STRIP_LEN);
            const tail = s.slice(0, TAIL_LEN);
            return [...head, ...resGrid![i]!, ...tail];
          }),
        );
        setStopAt([STRIP_LEN, STRIP_LEN, STRIP_LEN, STRIP_LEN, STRIP_LEN]); // top index of final window within each reel strip
        setStopRequested(true);
      }

      const returnMult = cost > 0 ? (cost + bet.profit) / cost : 0;
      setLast({ profit: bet.profit, outcome: bet.outcome, returnMult });
      void reportResult({
        game: luckySpin && !isFree ? "Slots 5x5 (Lucky)" : "Slots 5x5",
        profit: bet.profit,
        wager: cost,
        balance: bet.balanceAfter,
      });
    }, delay);
  };

  // Compute overlay reel marker: first N reels contribute to ways win.
  const reelsActive = waysWin?.len ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Slots5x5Sprite />
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
            disabled={spinning || freeSpinsLeft > 0}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                luckySpin ? "bg-amber-500/20 text-amber-100" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
              onClick={() => setLuckySpin((v) => !v)}
              disabled={spinning || freeSpinsLeft > 0}
              title="Lucky Spin costs +50% bet and boosts feature odds"
            >
              {luckySpin ? "Lucky Spin ON (+50%)" : "Lucky Spin"}
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
              disabled={spinning || freeSpinsLeft > 0 || balance < wager * 100}
              onClick={() => {
                if (spinning) return;
                if (balance < wager * 100) return;
                const buy = placeBet({
                  game: "Slots 5x5 Buy Feature",
                  wager: wager * 100,
                  resolve: () => ({ multiplier: 0, outcome: "Bought Free Spins" }),
                });
                setLast({ profit: buy.profit, outcome: "Bought Free Spins (100× bet)", returnMult: 0 });
                setFsTier("normal");
                setFreeSpinsLeft(5);
                void reportResult({
                  game: "Slots 5x5 Buy Feature",
                  profit: buy.profit,
                  wager: wager * 100,
                  balance: buy.balanceAfter,
                });
              }}
              title="Pay 100× bet to start Free Spins"
            >
              Buy Free Spins (100×)
            </button>

            <button
              type="button"
              className="glass-soft rounded-2xl bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/20 disabled:opacity-40"
              disabled={spinning || freeSpinsLeft > 0 || balance < wager * 200}
              onClick={() => {
                if (spinning) return;
                if (balance < wager * 200) return;
                const buy = placeBet({
                  game: "Slots 5x5 Buy Bonus",
                  wager: wager * 200,
                  resolve: () => ({ multiplier: 0, outcome: "Bought SUPER Free Spins" }),
                });
                setLast({ profit: buy.profit, outcome: "Bought SUPER Free Spins (200× bet)", returnMult: 0 });
                setFsTier("super");
                setFreeSpinsLeft(12);
                // SUPER free spins ignores Lucky (since it has its own math).
                setLuckySpin(false);
                void reportResult({
                  game: "Slots 5x5 Buy Bonus",
                  profit: buy.profit,
                  wager: wager * 200,
                  balance: buy.balanceAfter,
                });
              }}
              title="Pay 200× bet to start SUPER Free Spins"
            >
              Buy Bonus (200×)
            </button>
          </div>

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
            {Array.from({ length: 5 }, (_, reel) => (
              <ReelColumn
                key={`${spinId}-${reel}`}
                reelIndex={reel}
                strip={reelStrip[reel] ?? ["cherry"]}
                stopAtIndex={stopAt ? stopAt[reel] ?? null : null}
                spinning={spinning}
                stopRequested={stopRequested}
                turbo={turbo}
                onStopped={() => {
                  stoppedCountRef.current += 1;
                  if (stoppedCountRef.current >= 5) {
                    setSpinning(false);
                    setStopRequested(false);
                  }
                }}
              />
            ))}
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
