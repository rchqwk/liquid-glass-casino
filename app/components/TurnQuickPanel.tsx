"use client";

import { useState } from "react";

type Suit = "♠" | "♥" | "♦" | "♣" | "★";
type Card = { rank: string; suit: Suit };

function cardFromIndex(i: number): Card {
  if (i < 0) return { rank: "?", suit: "★" };
  // Match server's special encoding for magic cards (>= 1000)
  if (i >= 1000) {
    const t = i - 1000;
    const suitIdx = Math.floor(t / 20);
    const code = t % 20;
    if (code === 0) return { rank: "JOKER", suit: "★" };
    const suit = (["♠", "♥", "♦", "♣"] as const)[Math.max(0, Math.min(3, suitIdx))]!;
    const rank = code === 1 ? "A" : code === 11 ? "J" : code === 12 ? "Q" : "K";
    return { rank, suit };
  }
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  return { rank: RANKS[r]!, suit };
}

function handTotal(cards: number[], bonusPoints = 0): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    if (idx < 0) continue;
    const c = cardFromIndex(idx);
    const rank = c.rank;
    if (rank === "A") aces += 1;
    else if (rank === "J" || rank === "Q" || rank === "K") total += 10;
    else if (rank === "JOKER") total += 0;
    else total += Number(rank) || 0;
  }
  total += aces; // all aces as 1
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += Number(bonusPoints) || 0;
  return { total, soft };
}

function CardPip({ idx }: { idx: number }) {
  if (idx < 0) {
    return <div className="h-10 w-7 rounded-xl border border-white/15 bg-white/10" title="Hidden" />;
  }
  const c = cardFromIndex(idx);
  const red = c.suit === "♥" || c.suit === "♦";
  return (
    <div
      className={`flex h-10 w-7 items-center justify-center rounded-xl border border-white/15 bg-white/90 text-[10px] font-semibold ${
        red ? "text-rose-600" : "text-zinc-900"
      }`}
      title={`${c.rank}${c.suit}`}
    >
      {c.rank}
      <span className="ml-0.5 text-[10px]">{c.suit}</span>
    </div>
  );
}

export function TurnQuickPanel(props: {
  show: boolean;
  isMyTurn: boolean;
  myBet: number;
  handIndex: number; // 0-based
  handCount: number;
  hands?: Array<{ stood?: boolean; busted?: boolean; turnEnded?: boolean; cards?: number[]; bonusPoints?: number }>;
  timerLabel?: string;
  timerSeconds?: number;
  canSplit: boolean;
  canHit: boolean;
  canDoubleDown: boolean;
  canExtend?: boolean;
  extendUsed?: boolean;
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  onSplit: () => void;
  onExtend?: () => void;
  dealerCards: number[];
  dealerBonusPoints?: number;
  myCards: number[];
  myBonusPoints?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!props.show) return null;

  const HandBadges = () => {
    const hs = props.hands ?? [];
    if ((props.handCount ?? 1) <= 1 || hs.length <= 1) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {hs.map((h, i) => {
          const active = i === props.handIndex;
          const busted = !!h?.busted;
          const ended = !!h?.turnEnded;
          const cls = active
            ? "bg-emerald-500/20 text-emerald-100 border-emerald-300/20"
            : busted
              ? "bg-rose-500/15 text-rose-100 border-rose-300/20"
              : ended
                ? "bg-white/5 text-white/70 border-white/10"
                : "bg-white/5 text-white/70 border-white/10";
          const label = busted ? "BUST" : ended ? "DONE" : active ? "ACTIVE" : "WAIT";
          return (
            <div key={i} className={`rounded-2xl border px-3 py-2 text-[11px] ${cls}`}>
              <span className="font-semibold">Hand {i + 1}</span>
              <span className="ml-2 font-mono opacity-80">{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Floating tab (stack above Mystery Boxes) */}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[65]">
        {props.timerLabel && typeof props.timerSeconds === "number" ? (
          <div className="pointer-events-none absolute -top-16 right-0">
            <div
              className={`glass-soft rounded-2xl border px-3 py-2 text-[11px] text-white/80 ${
                props.isMyTurn ? "border-emerald-300/20 bg-emerald-500/10" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="text-white/60">{props.timerLabel}</div>
              <div className="font-mono text-sm text-white/90">{Math.max(0, props.timerSeconds)}s</div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className={`pointer-events-auto glass glass-shine relative rounded-3xl border px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10 ${
            props.isMyTurn ? "border-emerald-300/30 shadow-[0_0_30px_rgba(16,185,129,.20)]" : "border-white/10"
          }`}
          onClick={() => setOpen(true)}
        >
          <div className="font-semibold">
            {props.isMyTurn ? "Your turn" : "Table"}
            {props.handCount > 1 ? (
              <span className="ml-2 text-[11px] font-medium text-white/60">
                (Hand {props.handIndex + 1}/{props.handCount})
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Bet: <span className="font-mono text-white/90">{props.myBet.toFixed(2)}</span>
          </div>
          {props.isMyTurn ? (
            <div className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-2 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,.35)]">
              !
            </div>
          ) : null}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {props.isMyTurn ? "Your turn" : "Actions"}
                  {props.handCount > 1 ? (
                    <span className="ml-2 text-xs font-medium text-white/60">
                      (Hand {props.handIndex + 1}/{props.handCount})
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Bet: <span className="font-mono text-white/80">{props.myBet.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-white/80">Dealer</div>
                  <div className="text-[11px] text-white/60">
                    Total:{" "}
                    <span className="font-mono text-white/85">
                      {handTotal(props.dealerCards, props.dealerBonusPoints ?? 0).total}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.dealerCards.map((c, i) => (
                    <CardPip key={`${c}-${i}`} idx={c} />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-white/80">You</div>
                  <div className="text-[11px] text-white/60">
                    Total:{" "}
                    <span className="font-mono text-white/85">
                      {handTotal(props.myCards, props.myBonusPoints ?? 0).total}
                    </span>
                  </div>
                </div>

                {(props.hands?.length ?? 0) > 1 ? (
                  <div className="mt-3 flex flex-col gap-3">
                    {(props.hands ?? []).map((h, i) => {
                      const cards = (h?.cards?.length ? h.cards : i === props.handIndex ? props.myCards : []) ?? [];
                      const bonus = Number(h?.bonusPoints ?? (i === props.handIndex ? props.myBonusPoints : 0) ?? 0) || 0;
                      const hv = handTotal(cards, bonus);
                      const active = i === props.handIndex;
                      const status = h?.busted ? "BUST" : h?.turnEnded ? "DONE" : active ? "ACTIVE" : "WAIT";
                      return (
                        <div
                          key={i}
                          className={`rounded-3xl border border-white/10 bg-black/10 p-3 ${active ? "ring-2 ring-emerald-300/30" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
                            <div className="font-semibold text-white/80">
                              Hand {i + 1}{" "}
                              <span className="ml-2 font-mono text-white/60">{status}</span>
                            </div>
                            <div>
                              Total: <span className="font-mono text-white/85">{hv.total}</span>
                              {hv.soft ? <span className="ml-2 text-white/45">(soft)</span> : null}
                              {bonus ? <span className="ml-2 text-amber-200">(+{bonus})</span> : null}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {cards.map((c, idx) => (
                              <CardPip key={`${c}-${idx}`} idx={c} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <HandBadges />
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {props.myCards.map((c, i) => (
                        <CardPip key={`${c}-${i}`} idx={c} />
                      ))}
                    </div>
                    <HandBadges />
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-white/80">Actions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                  onClick={props.onHit}
                  disabled={!props.isMyTurn || !props.canHit}
                >
                  Hit
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                  onClick={props.onStand}
                  disabled={!props.isMyTurn}
                >
                  Stand
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                  onClick={props.onDoubleDown}
                  disabled={!props.isMyTurn || !props.canDoubleDown}
                  title="Double your bet, draw one card, and stand"
                >
                  DD
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                  disabled={!props.isMyTurn || !props.canSplit}
                  onClick={props.onSplit}
                  title="Split (up to 4 hands). If your cards don't match, requires FREE_SPLIT."
                >
                  Split
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                  disabled={!props.isMyTurn || !props.canExtend || !!props.extendUsed}
                  onClick={props.onExtend}
                  title="Extend your turn timer once"
                >
                  Extend timer
                </button>
              </div>
              {props.isMyTurn ? (
                <div className="mt-3 text-[11px] text-emerald-200/80">
                  It’s your turn. (This panel is just a quick-access overlay.)
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-white/50">You can only act on your turn.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
