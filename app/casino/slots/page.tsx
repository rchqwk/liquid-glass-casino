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
  type WaysWinInfo,
  analyzeWaysWin,
  spinSlots243Ways,
} from "./slotEngine";

function ReelColumnEmoji(props: {
  reelIndex: number;
  strip: SymbolKey[];
  stopAtIndex: number | null;
  spinning: boolean;
  stopRequested: boolean;
  turbo: boolean;
  onStopped: () => void;
}) {
  const { reelIndex, strip, stopAtIndex, spinning, stopRequested, turbo, onStopped } = props;

  const CELL_PX = 56; // h-14
  const REPEAT = 4; // lighter DOM to avoid Safari blank frames
  const totalPx = strip.length * CELL_PX;

  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef<number>(totalPx * 2);
  const stoppedRef = useRef(false);

  const repeated = useMemo(() => {
    const out: SymbolKey[] = [];
    for (let i = 0; i < REPEAT; i += 1) out.push(...strip);
    return out;
  }, [strip]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.transform = `translate3d(0, -${offsetRef.current}px, 0)`;
  }, [strip]);

  // Continuous scrolling while spinning (until stopRequested)
  useEffect(() => {
    if (!spinning || stopRequested) return;
    const el = innerRef.current;
    if (!el) return;

    stoppedRef.current = false;
    el.style.transition = "none";
    const speed = turbo ? 42 : 24;

    const tick = () => {
      offsetRef.current += speed;
      const max = totalPx * 4;
      const min = totalPx * 2;
      if (offsetRef.current > max) offsetRef.current -= totalPx * 2;
      if (offsetRef.current < min) offsetRef.current += totalPx * 2;
      el.style.transform = `translate3d(0, -${offsetRef.current}px, 0)`;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [spinning, stopRequested, turbo, totalPx]);

  // Ease-out to a precise stop position once stopRequested
  useEffect(() => {
    if (!spinning || !stopRequested) return;
    if (stopAtIndex == null) return;
    const el = innerRef.current;
    if (!el) return;

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    // Normalize current position into a safe range (prevents scrolling past the rendered strip)
    const curRaw = offsetRef.current;
    const curMod = ((curRaw % totalPx) + totalPx) % totalPx;
    const cur = totalPx + curMod;
    const targetMod = stopAtIndex * CELL_PX;
    const delta = (targetMod - curMod + totalPx) % totalPx;

    const extraRot = turbo ? 1 : 2;
    const target = cur + delta + totalPx * extraRot;
    offsetRef.current = target;

    const duration = (turbo ? 520 : 980) + reelIndex * (turbo ? 90 : 130);
    el.style.transition = `transform ${duration}ms cubic-bezier(.12,.86,.2,1)`;
    el.style.transform = `translate3d(0, -${target}px, 0)`;

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
  }, [spinning, stopRequested, stopAtIndex, turbo, reelIndex, totalPx, onStopped]);

  return (
    <div className="relative h-[168px] w-14 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div ref={innerRef} className="will-change-transform">
        {repeated.map((sym, idx) => (
          <div
            key={idx}
            className="flex h-14 w-14 items-center justify-center border-b border-white/5 text-2xl"
          >
            {sym}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_0_1px_rgba(255,255,255,.06),inset_0_16px_28px_rgba(0,0,0,.35),inset_0_-16px_28px_rgba(0,0,0,.35)]" />
    </div>
  );
}

export default function SlotsPage() {
  const { placeBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const cfg = useGameConfig();

  const [wager, setWager] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState<number>(0); // -1 = infinite
  const autoRef = useRef(false);
  const [turbo, setTurbo] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [stopOnWin, setStopOnWin] = useState(true);
  const [stopOnWinOver5x, setStopOnWinOver5x] = useState(false);
  const [stopOnFeature, setStopOnFeature] = useState(true);
  const [autoPreset, setAutoPreset] = useState<0 | 10 | 25 | 50 | -1>(25);

  const [holdMask, setHoldMask] = useState<boolean[]>([false, false, false, false, false]);
  const [nudge, setNudge] = useState<number[]>([0, 0, 0, 0, 0]); // -1/0/+1, applied to held reels
  const MAX_HELD_REELS = 2;

  // True reel-strip animation state
  const REEL_BASE_LEN = 28;
  const REEL_TAIL_LEN = 8;
  const [spinId, setSpinId] = useState(0);
  const [reelStrip, setReelStrip] = useState<SymbolKey[][]>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: REEL_BASE_LEN }, () => "🍒")),
  );
  const [stopAt, setStopAt] = useState<number[] | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const stoppedCountRef = useRef(0);
  const baseIndexRef = useRef(0);

  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [pendingGamble, setPendingGamble] = useState<number | null>(null);
  const [lastGrid, setLastGrid] = useState<SymbolKey[][] | null>(null);
  const [lastWasFreeSpin, setLastWasFreeSpin] = useState(false);
  const [holdSpinSteps, setHoldSpinSteps] = useState<SymbolKey[][][] | null>(null);
  const [holdSpinStepIdx, setHoldSpinStepIdx] = useState(0);
  const [lastWaysWin, setLastWaysWin] = useState<WaysWinInfo | null>(null);
  const [luckySpin, setLuckySpin] = useState(false);

  const [last, setLast] = useState<{
    profit: number;
    outcome: string;
    multiplier: number;
  } | null>(null);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  // Play Hold&Spin animation frames if present
  useEffect(() => {
    if (!holdSpinSteps || holdSpinSteps.length === 0) return;
    setHoldSpinStepIdx(0);
    const id = window.setInterval(() => {
      setHoldSpinStepIdx((i) => {
        const next = i + 1;
        if (next >= holdSpinSteps.length) {
          window.clearInterval(id);
          return i;
        }
        return next;
      });
    }, turbo ? 220 : 320);
    return () => window.clearInterval(id);
  }, [holdSpinSteps, turbo]);

  useEffect(() => {
    if (!holdSpinSteps || holdSpinSteps.length === 0) return;
    if (holdSpinStepIdx < holdSpinSteps.length - 1) return;
    const id = window.setTimeout(() => setHoldSpinSteps(null), 1200);
    return () => window.clearTimeout(id);
  }, [holdSpinStepIdx, holdSpinSteps]);

  const payInfo = useMemo(
    () => ({
      ways: 243,
      extraChanceProbability: 0.156, // +30% vs 0.12
    }),
    [],
  );

  const defaultGrid: SymbolKey[][] = useMemo(
    () => [
      ["🍒", "⭐", "🍋"],
      ["🍉", "🍇", "⭐"],
      ["🔔", "🍒", "🍋"],
      ["💎", "🥨", "🪙"],
      ["7", "🍀", "👑"],
    ],
    [],
  );

  const buildRandomStrip = useMemo(() => {
    const ids: SymbolKey[] = ["🍒", "🍋", "🍇", "🍉", "🍬", "🥨", "🍀", "⭐", "🔔", "💎", "👑", "7", "🪙", "💰"];
    const weights = new Map<SymbolKey, number>([
      ["🍒", 22],
      ["🍋", 22],
      ["🍇", 18],
      ["🍉", 16],
      ["🍬", 24],
      ["🥨", 24],
      ["🍀", 20],
      ["⭐", 10],
      ["🔔", 8],
      ["💎", 2],
      ["👑", 4],
      ["7", 2],
      ["🪙", 1.3],
      ["💰", 0.8],
    ]);
    const total = ids.reduce((a, s) => a + (weights.get(s) ?? 1), 0);
    const pick = (r01: number) => {
      let x = r01 * total;
      for (const s of ids) {
        x -= weights.get(s) ?? 1;
        if (x <= 0) return s;
      }
      return "🍒";
    };
    return (rng: () => number, len: number) => Array.from({ length: len }, () => pick(rng()));
  }, []);

  const doSpin = () => {
    if (spinning) return;
    if (!Number.isFinite(wager) || wager <= 0) return;
    if (pendingGamble != null) return;

    const mode: SpinMode = freeSpinsLeft > 0 ? "freespin" : "base";
    const isFree = mode === "freespin";

    // In this prototype, "free spins" still use the same wager, but we refund the stake via +1x base multiplier.
    if (balance < wager) {
      setAuto(false);
      setAutoRemaining(0);
      return;
    }

    setSpinning(true);
    setLastWaysWin(null);
    setStopRequested(false);
    setStopAt(null);
    setSpinId((x) => x + 1);
    stoppedCountRef.current = 0;

    // Start reel motion immediately (client-side animation only).
    const seed = Date.now() + Math.floor(Math.random() * 999999);
    const rng = () => {
      baseIndexRef.current = (baseIndexRef.current * 1664525 + 1013904223 + seed) >>> 0;
      return (baseIndexRef.current % 100000) / 100000;
    };
    setReelStrip(Array.from({ length: 5 }, () => buildRandomStrip(rng, REEL_BASE_LEN)));

    window.setTimeout(() => {
      let grid: SymbolKey[][] | null = null;
      let triggeredFreeSpins = false;
      let triggeredHoldSpin = false;
      let hsSteps: SymbolKey[][][] | null = null;

      const bet = placeBet({
        game: isFree ? "EMOJI Hold and Win (Free Spin)" : "EMOJI Hold and Win",
        wager: wager * (luckySpin && !isFree ? 1.5 : 1),
        resolve: (rng) => {
          const heldColumns =
            !isFree && lastGrid
              ? lastGrid.map((col, i) => (holdMask[i] ? col : null))
              : [null, null, null, null, null];
          const spinRes = spinSlots243Ways({
            rngFloat: rng.float,
            mode,
            payoutScale: cfg.slotsPayoutScale ?? 1,
            extraChanceProbability: payInfo.extraChanceProbability,
            heldColumns,
            nudge,
            lucky:
              luckySpin && !isFree
                ? { scatterWeightMultiplier: 1.25, ensureMinScatters: 2, extraWildChance: 0.25 }
                : undefined,
          });
          grid = spinRes.grid;
          triggeredFreeSpins = spinRes.triggeredFreeSpins;
          triggeredHoldSpin = spinRes.triggeredHoldSpin;
          hsSteps = spinRes.holdSpin?.steps ?? null;
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
      setHoldSpinSteps(hsSteps);
      setLastWaysWin(grid ? analyzeWaysWin(grid) : null);
      void reportResult({
        game: luckySpin && !isFree ? "EMOJI Hold and Win (Lucky)" : "EMOJI Hold and Win",
        profit: bet.profit,
        wager: wager * (luckySpin && !isFree ? 1.5 : 1),
        balance: bet.balanceAfter,
      });

      // Tell reels to stop on the final window
      if (!hsSteps && grid) {
        setReelStrip((prev) =>
          prev.map((s, i) => {
            const head = s.slice(0, REEL_BASE_LEN);
            const tail = s.slice(0, REEL_TAIL_LEN);
            return [...head, ...grid![i]!, ...tail];
          }),
        );
        setStopAt([REEL_BASE_LEN, REEL_BASE_LEN, REEL_BASE_LEN, REEL_BASE_LEN, REEL_BASE_LEN]);
        setStopRequested(true);
      } else {
        // If a hold&spin bonus is running, don't keep reels spinning.
        setSpinning(false);
        setStopRequested(false);
      }

      // Free spins bookkeeping
      if (triggeredFreeSpins && freeSpinsLeft <= 0) {
        setFreeSpinsLeft(5);
      } else if (freeSpinsLeft > 0) {
        setFreeSpinsLeft((n) => Math.max(0, n - 1));
      }

      // If a feature triggers, clear holds/nudges (cabinet-style)
      if (triggeredFreeSpins || triggeredHoldSpin) {
        setHoldMask([false, false, false, false, false]);
        setNudge([0, 0, 0, 0, 0]);
      } else {
        // Holds are single-use (apply to NEXT spin only), nudges are also single-use.
        // This keeps them "finite" like a physical cabinet.
        setHoldMask([false, false, false, false, false]);
        setNudge([0, 0, 0, 0, 0]);
      }

      // Gamble offer only after a paid win (and only when not autoplaying).
      if (!autoRef.current && !isFree && bet.profit > 0 && !triggeredHoldSpin) {
        setPendingGamble(bet.profit);
      } else {
        setPendingGamble(null);
      }

      // Autoplay stop conditions / countdown
      if (autoRef.current) {
        const returnMult = wager > 0 ? (wager + bet.profit) / wager : 0;
        const shouldStop =
          (stopOnWin && bet.profit > 0) ||
          (stopOnWinOver5x && returnMult >= 5) ||
          (stopOnFeature && (triggeredFreeSpins || triggeredHoldSpin));
        if (shouldStop) {
          setAuto(false);
          setAutoRemaining(0);
        } else if (autoRemaining > 0) {
          setAutoRemaining((n) => Math.max(0, n - 1));
          if (autoRemaining - 1 <= 0) setAuto(false);
        }
      }

    }, turbo ? 350 : 850);
  };

  useEffect(() => {
    if (!auto) return;
    if (spinning) return;
    if (pendingGamble != null) {
      // Autoplay auto-collects.
      setPendingGamble(null);
      return;
    }
    if (autoRemaining === 0) {
      setAuto(false);
      return;
    }
    const id = window.setTimeout(() => {
      if (autoRef.current) doSpin();
    }, 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, spinning, wager, cfg.slotsPayoutScale, balance, pendingGamble, freeSpinsLeft, autoRemaining]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">EMOJI Hold and Win</h2>
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
            {auto ? (
              <div className="mt-2 text-white/60">
                Autoplay:{" "}
                <span className="font-mono text-white/80">
                  {autoRemaining < 0 ? "∞" : autoRemaining}
                </span>{" "}
                spins left
                {turbo ? <span className="ml-2 text-xs text-white/45">(Turbo)</span> : null}
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
            disabled={spinning || freeSpinsLeft > 0 || holdSpinSteps != null}
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
                // Buy feature: pay 100× bet to instantly start free spins.
                const buy = placeBet({
                  game: "EMOJI Hold and Win Buy Feature",
                  wager: wager * 100,
                  resolve: () => ({ multiplier: 0, outcome: "Bought Free Spins" }),
                });
                setLast({
                  profit: buy.profit,
                  outcome: "Bought Free Spins (100× bet)",
                  multiplier: buy.multiplier,
                });
                setFreeSpinsLeft(5);
                void reportResult({
                  game: "EMOJI Hold and Win Buy Feature",
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
              disabled={spinning || freeSpinsLeft > 0 || holdSpinSteps != null || balance < wager * 500}
              onClick={() => {
                if (spinning) return;
                if (balance < wager * 500) return;
                // Buy bonus: pay 500× bet to start Hold&Spin immediately.
                const buy = placeBet({
                  game: "EMOJI Hold and Win Buy Bonus",
                  wager: wager * 500,
                  resolve: (rng) => {
                    const spinRes = spinSlots243Ways({
                      rngFloat: rng.float,
                      mode: "base",
                      payoutScale: cfg.slotsPayoutScale ?? 1,
                      extraChanceProbability: payInfo.extraChanceProbability,
                      forceHoldSpin: true,
                    });
                    return { multiplier: spinRes.winMultiplier, outcome: "Bought Hold&Spin" };
                  },
                });
                setLast({ profit: buy.profit, outcome: "Bought Hold&Spin (500× bet)", multiplier: buy.multiplier });
                void reportResult({
                  game: "EMOJI Hold and Win Buy Bonus",
                  profit: buy.profit,
                  wager: wager * 500,
                  balance: buy.balanceAfter,
                });
              }}
              title="Pay 500× bet to start Hold&Spin bonus"
            >
              Buy Bonus (500×)
            </button>
          </div>

          {/* Cabinet-style options */}
          <button
            type="button"
            className="mt-4 text-xs text-white/65 underline decoration-white/20 underline-offset-4 hover:text-white"
            onClick={() => setShowOptions((v) => !v)}
          >
            {showOptions ? "Hide options" : "Options"}
          </button>
          {showOptions ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={turbo}
                    onChange={(e) => setTurbo(e.target.checked)}
                  />
                  Turbo
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stopOnWin}
                    onChange={(e) => setStopOnWin(e.target.checked)}
                  />
                  Stop on win
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stopOnWinOver5x}
                    onChange={(e) => setStopOnWinOver5x(e.target.checked)}
                  />
                  Stop on win ≥ 5x
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stopOnFeature}
                    onChange={(e) => setStopOnFeature(e.target.checked)}
                  />
                  Stop on feature
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-white/55">Autoplay preset:</span>
                <select
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                  value={autoPreset}
                  onChange={(e) => setAutoPreset(Number(e.target.value) as any)}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={-1}>∞</option>
                </select>
              </div>
            </div>
          ) : null}

          {/* Hold & Nudge (only in base game, after at least one spin) */}
          {/* Hold controls moved under reels (Result panel) */}

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
              onClick={() => {
                setAuto((a) => {
                  const next = !a;
                  if (next) {
                    setAutoRemaining(autoPreset);
                  } else {
                    setAutoRemaining(0);
                  }
                  return next;
                });
              }}
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
                      game: "EMOJI Hold and Win Gamble",
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
                    void reportResult({
                      game: "EMOJI Hold and Win Gamble",
                      profit: bet.profit,
                      wager: amount,
                      balance: bet.balanceAfter,
                    });
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

          {lastWaysWin && lastWaysWin.pay > 0 ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              Ways win: <span className="text-base">{lastWaysWin.symbol}</span>{" "}
              <span className="font-mono">{lastWaysWin.len}</span> reels •{" "}
              <span className="font-mono">{lastWaysWin.ways}</span> ways
            </div>
          ) : null}

          {holdSpinSteps ? (
            <p className="mt-2 text-xs text-white/60">
              Hold &amp; Spin bonus… <span className="font-mono">{holdSpinStepIdx + 1}</span>/
              <span className="font-mono">{holdSpinSteps.length}</span>
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-center">
            <div className="relative">
              {/* Visual marker above reels to show which reels are part of the current ways win */}
              <div className="mb-2 grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, i) => {
                  const active =
                    !spinning && !!lastWaysWin && lastWaysWin.pay > 0 && i < lastWaysWin.len;
                  return (
                    <div
                      key={i}
                      className={`h-2 rounded-full ${
                        active ? "bg-emerald-400/70" : "bg-white/10"
                      }`}
                      title={active ? "This reel contributes to the winning ways" : ""}
                    />
                  );
                })}
              </div>

              {holdSpinSteps ? (
                <div className="grid grid-cols-5 gap-2">
                  {holdSpinSteps[Math.min(holdSpinStepIdx, holdSpinSteps.length - 1)]!.map(
                    (col, x) => (
                      <div key={x} className="flex flex-col gap-2">
                        {col.map((s, y) => (
                          <div
                            key={`${x}-${y}`}
                            className="glass-soft flex h-14 w-14 items-center justify-center rounded-3xl text-2xl"
                            title={
                              s === WILD
                                ? "Wild"
                                : s === SCATTER
                                  ? "Scatter"
                                  : s === "💰"
                                    ? "Hold & Spin Coin"
                                    : ""
                            }
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              ) : spinning ? (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }, (_, reel) => (
                    <ReelColumnEmoji
                      key={`${spinId}-${reel}`}
                      reelIndex={reel}
                      strip={reelStrip[reel] ?? ["🍒"]}
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
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {(lastGrid ?? defaultGrid).map((col, x) => (
                    <div key={x} className="flex flex-col gap-2">
                      {col.map((s, y) => (
                        <div
                          key={`${x}-${y}`}
                          className={`glass-soft flex h-14 w-14 items-center justify-center rounded-3xl text-2xl ${
                            lastWaysWin?.matched?.[x]?.[y] ? "ring-2 ring-emerald-300/70" : ""
                          }`}
                          title={
                            s === WILD
                              ? "Wild"
                              : s === SCATTER
                                ? "Scatter"
                                : s === "💰"
                                  ? "Hold & Spin Coin"
                                  : ""
                          }
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hold reels directly below the reels (base game only) */}
          {!spinning && freeSpinsLeft <= 0 && lastGrid ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-medium text-white/70">Hold reels (next spin)</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {holdMask.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`rounded-2xl px-2 py-2 text-xs font-medium transition ${
                      h ? "bg-emerald-500/20 text-emerald-100" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() =>
                      setHoldMask((m) => {
                        const next = [...m];
                        const nextVal = !next[i];
                        const heldCount = next.filter(Boolean).length;
                        // Limit holds (finite) to avoid indefinite advantage.
                        if (nextVal && heldCount >= MAX_HELD_REELS) return next;
                        next[i] = nextVal;
                        return next;
                      })
                    }
                  >
                    {h ? "HELD" : "HOLD"}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                {holdMask.map((h, i) => (
                  <div key={i} className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={!h}
                      className="rounded-xl bg-white/5 px-2 py-1 text-xs text-white/75 disabled:opacity-30"
                      onClick={() =>
                        setNudge((n) => {
                          // Only allow one nudge per spin (finite).
                          const next = [0, 0, 0, 0, 0];
                          next[i] = -1;
                          return next as number[];
                        })
                      }
                      title="Nudge up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={!h}
                      className="rounded-xl bg-white/5 px-2 py-1 text-xs text-white/75 disabled:opacity-30"
                      onClick={() =>
                        setNudge((n) => {
                          // Only allow one nudge per spin (finite).
                          const next = [0, 0, 0, 0, 0];
                          next[i] = 1;
                          return next as number[];
                        })
                      }
                      title="Nudge down"
                    >
                      ▼
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-3 text-xs text-white/60 underline decoration-white/20 underline-offset-4 hover:text-white"
                onClick={() => {
                  setHoldMask([false, false, false, false, false]);
                  setNudge([0, 0, 0, 0, 0]);
                }}
              >
                Clear holds
              </button>
              <p className="mt-2 text-[11px] leading-5 text-white/55">
                Limits: up to {MAX_HELD_REELS} held reels; one nudge per spin; holds apply once then reset.
              </p>
            </div>
          ) : null}

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
                <span className="font-medium text-white/70">{SCATTER}</span> ×3 triggers 5 free spins.
              </li>
              <li>
                Extra Chance: when you land exactly 2 scatters, it may upgrade into free spins.
              </li>
              <li>
                <span className="font-medium text-white/70">💰</span> ×3 triggers Hold &amp; Spin (coins lock with respins).
              </li>
              <li>Hold reels + optional nudge available between base-game spins.</li>
              <li>Gamble: after a paid win you can double-or-nothing (50/50).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
