"use client";

import type { BetKey } from "./rouletteMath";
import { colorOf, RED } from "./rouletteMath";

const ROWS = 12;
const COLS = 3;

function classForNumber(n: number) {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-500/35 text-emerald-50 border-emerald-200/15";
  if (c === "red") return "bg-rose-500/35 text-rose-50 border-rose-200/15";
  return "bg-white/10 text-white/85 border-white/15";
}

function chipLabel(amount: number) {
  if (amount >= 1000) return `${Math.round(amount / 100) / 10}k`;
  return `${amount}`;
}

export function RouletteBoard(props: {
  bets: Record<BetKey, number>;
  onAddBet: (key: BetKey) => void;
  disabled?: boolean;
}) {
  const { bets, onAddBet, disabled } = props;

  const numbersByRow: number[][] = [];
  for (let r = ROWS; r >= 1; r -= 1) {
    numbersByRow.push([r * 3, r * 3 - 1, r * 3 - 2]);
  }

  return (
    <div className="glass-soft glass-shine rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Board</p>
        <p className="text-xs text-white/55">Tap cells to place chips</p>
      </div>

      <div className="mt-3 grid grid-cols-[64px_1fr] gap-2">
        {/* 0 */}
        <button
          type="button"
          className={`relative row-span-[12] flex h-full min-h-[384px] items-center justify-center rounded-2xl border text-lg font-semibold ${classForNumber(
            0,
          )} transition hover:brightness-110`}
          onClick={() => onAddBet("n:0")}
          disabled={!!disabled}
        >
          0
          {bets["n:0"] ? (
            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-zinc-900">
              {chipLabel(bets["n:0"])}
            </span>
          ) : null}
        </button>

        {/* 1–36 (3 columns) */}
        <div className="grid grid-rows-12 gap-2">
          {numbersByRow.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-3 gap-2">
              {row.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`relative flex h-8 items-center justify-center rounded-xl border text-sm font-semibold ${classForNumber(
                    n,
                  )} transition hover:brightness-110`}
                  onClick={() => onAddBet(`n:${n}` as BetKey)}
                  disabled={!!disabled}
                >
                  {n}
                  {bets[`n:${n}` as BetKey] ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-900">
                      {chipLabel(bets[`n:${n}` as BetKey])}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Outside bets */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <OutsideBet
          label="1–18"
          sub="low"
          activeAmount={bets.low}
          onClick={() => onAddBet("low")}
          disabled={!!disabled}
        />
        <OutsideBet
          label="EVEN"
          sub="even"
          activeAmount={bets.even}
          onClick={() => onAddBet("even")}
          disabled={!!disabled}
        />
        <OutsideBet
          label="RED"
          sub="red"
          tone="red"
          activeAmount={bets.red}
          onClick={() => onAddBet("red")}
          disabled={!!disabled}
        />
        <OutsideBet
          label="BLACK"
          sub="black"
          tone="black"
          activeAmount={bets.black}
          onClick={() => onAddBet("black")}
          disabled={!!disabled}
        />
        <OutsideBet
          label="ODD"
          sub="odd"
          activeAmount={bets.odd}
          onClick={() => onAddBet("odd")}
          disabled={!!disabled}
        />
        <OutsideBet
          label="19–36"
          sub="high"
          activeAmount={bets.high}
          onClick={() => onAddBet("high")}
          disabled={!!disabled}
        />
      </div>

      <p className="mt-3 text-[11px] leading-4 text-white/55">
        Straight-up number pays <span className="font-mono text-white/70">36x</span>. Outside bets pay{" "}
        <span className="font-mono text-white/70">2x</span>.
      </p>
    </div>
  );
}

function OutsideBet(props: {
  label: string;
  sub: string;
  tone?: "red" | "black";
  activeAmount?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { label, sub, tone, activeAmount, onClick, disabled } = props;
  const bg =
    tone === "red"
      ? "bg-rose-500/25 border-rose-200/15"
      : tone === "black"
        ? "bg-white/10 border-white/15"
        : "bg-white/5 border-white/10";
  return (
    <button
      type="button"
      disabled={!!disabled}
      className={`relative rounded-2xl border px-3 py-3 text-left transition hover:bg-white/10 disabled:opacity-40 ${bg}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/85">{label}</span>
        <span className="text-[10px] text-white/55">{sub}</span>
      </div>
      {activeAmount ? (
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-zinc-900">
          {activeAmount}
        </span>
      ) : null}
    </button>
  );
}
