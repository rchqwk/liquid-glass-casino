"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TurnQuickPanel } from "../../../components/TurnQuickPanel";
import { useWallet } from "../../../lib/wallet";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { rank: string; suit: Suit; value: number };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

function handValue(cards: number[], bonusPoints = 0) {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    const c = cardFromIndex(idx);
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  total += aces;
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += bonusPoints;
  return { total, soft };
}

function CardView({ idx, hidden }: { idx: number; hidden?: boolean }) {
  if (idx < 0 || hidden) {
    return (
      <div className="relative flex h-20 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      </div>
    );
  }
  const c = cardFromIndex(idx);
  const isRed = c.suit === "♥" || c.suit === "♦";
  return (
    <div className="relative flex h-20 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
      <div className={`absolute left-2 top-2 text-[10px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[9px] leading-3">{c.suit}</div>
      </div>
      <div className={`text-xl ${isRed ? "text-rose-600" : "text-zinc-900"}`}>{c.suit}</div>
      <div className={`absolute bottom-2 right-2 rotate-180 text-[10px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[9px] leading-3">{c.suit}</div>
      </div>
    </div>
  );
}

type Seat = {
  userId: number;
  username: string;
  missedRounds: number;
  bet: number;
  cards: number[];
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  extendUsedThisTurn?: boolean;
  inventory?: Record<string, number>;
  usedThisRound?: Record<string, boolean>;
  doublePayoutArmed?: boolean;
  bjProtected?: boolean;
};

type BJState = {
  id: string;
  name: string;
  public: boolean;
  phase: string;
  round: number;
  bettingEndsAt: number;
  turnEndsAt: number;
  dealerWindowEndsAt: number;
  seats: Array<Seat | null>;
  spectators: number[];
  participants: number[];
  turnIndex: number;
  dealer: { cards: number[]; bonusPoints: number };
  peekCard?: number | null;
  meSeatIndex?: number;
  meInventory?: any;
  lastResult?: {
    outcome: string;
    multiplier: number;
    wager?: number;
    settlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
  } | null;
};

export default function BlackjackTablePage() {
  const { beginBet, settleBet } = useWallet();
  const params = useParams<{ id?: string | string[] }>();
  const tableId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined;
  const safeTableId = tableId && tableId !== "undefined" ? tableId : null;
  const [state, setState] = useState<BJState | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [reportedKey, setReportedKey] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  const [targetPopup, setTargetPopup] = useState<{ open: boolean; specialId: string | null; target: number | null }>({
    open: false,
    specialId: null,
    target: null,
  });

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!safeTableId) {
          setErr("Invalid table id");
          setState(null);
          return;
        }
        const res = await fetch(`/api/blackjack/tables/${safeTableId}`, { cache: "no-store" });
        const data = (await res.json()) as any;
        if (cancelled) return;
        if (!res.ok) {
          setErr(data?.error ?? "Failed to load table");
          setState(null);
          return;
        }
        setErr(null);
        setState(data.state);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [safeTableId, tick]);

  const now = Date.now();
  const bettingLeft = Math.max(0, Math.ceil(((state?.bettingEndsAt ?? 0) - now) / 1000));
  const turnLeft = Math.max(0, Math.ceil(((state?.turnEndsAt ?? 0) - now) / 1000));
  const dealerLeft = Math.max(0, Math.ceil(((state?.dealerWindowEndsAt ?? 0) - now) / 1000));

  const mySeat = state?.meSeatIndex != null && state.meSeatIndex >= 0 ? state.seats[state.meSeatIndex] : null;
  const myTurnSeat = state?.participants?.[state.turnIndex] ?? null;
  const isMyTurn = mySeat && state?.phase === "player_turns" && myTurnSeat === state.meSeatIndex;
  const canDoubleDown = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2 && (mySeat?.bet ?? 0) > 0;
  const canSplit = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2;

  // Auto-reserve funds for carried bets (bet appears prefilled due to carryBetNext)
  useEffect(() => {
    if (!state || state.phase !== "betting") return;
    if (!mySeat) return;
    const wager = Number(mySeat.bet ?? 0);
    const hasNonce = Array.isArray((mySeat as any).hands?.[0]?.nonces) && ((mySeat as any).hands?.[0]?.nonces?.length ?? 0) > 0;
    if (!(wager > 0) || hasNonce) return;
    const started = beginBet({ game: "Blackjack (MP)", wager });
    if ("error" in started) return;
    void post("bet", { amount: wager, betNonce: started.nonce });
  }, [state?.phase, state?.round, mySeat?.bet]);

  const dealerTotal = useMemo(() => {
    if (!state) return 0;
    const visible = state.dealer.cards.filter((c) => c >= 0);
    return handValue(visible, state.dealer.bonusPoints).total;
  }, [state]);

  const canUseDealerSpecial = state?.phase === "dealer_window";
  const canUseAnytimeSpecial =
    state?.phase === "player_turns" || state?.phase === "dealer" || state?.phase === "dealer_window";

  // Report wager/profit for stats once per round (so Games gallery updates per-game totals).
  useEffect(() => {
    if (!state) return;
    if (state.phase !== "settling") return;
    if (!mySeat || !state.lastResult) return;
    const wager = Number(state.lastResult.wager ?? mySeat.bet ?? 0);
    if (!(wager > 0)) return;
    const key = `${safeTableId ?? "?"}:${state.round}`;
    if (reportedKey === key) return;

    const profit = wager * (Number(state.lastResult.multiplier ?? 0) - 1);
    setReportedKey(key);
    void fetch("/api/leaderboard/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        game: "Blackjack (MP)",
        wager,
        profit,
      }),
    }).catch(() => {});
  }, [state, mySeat, reportedKey, safeTableId]);

  // Apply payouts to the client wallet once per round (updates Topbar balance)
  const [walletSettledKey, setWalletSettledKey] = useState<string | null>(null);
  useEffect(() => {
    if (!state) return;
    if (state.phase !== "settling") return;
    if (!mySeat || !state.lastResult) return;
    const key = `wallet:${safeTableId ?? "?"}:${state.round}`;
    if (walletSettledKey === key) return;
    setWalletSettledKey(key);
    const settlements = state.lastResult.settlements ?? [];
    for (const st of settlements) {
      const nonce = Number(st.nonce);
      if (!Number.isFinite(nonce) || nonce <= 0) continue;
      settleBet({
        nonce,
        multiplier: Number(st.multiplier ?? 0),
        outcome: String(st.outcome ?? "Settled"),
      });
    }
  }, [state, mySeat, safeTableId, walletSettledKey, settleBet]);

  const join = async (spectate?: boolean) => {
    setErr(null);
    if (!safeTableId) {
      setErr("Invalid table id");
      return;
    }
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spectate: !!spectate }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      setErr(data?.error ?? "Failed to join");
      return;
    }
    setState(data.state);
  };

  const post = async (path: string, body?: any) => {
    setErr(null);
    if (!safeTableId) {
      setErr("Invalid table id");
      return;
    }
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    const data = (await res.json()) as any;
    if (!res.ok) setErr(data?.error ?? "Action failed");
    if (data?.state) setState(data.state);
  };

  const placeBetWithWallet = async () => {
    if (state?.phase !== "betting") return;
    const wager = Math.round(Number(betAmount ?? 0) * 100) / 100;
    if (!(wager > 0)) {
      setErr("Invalid bet amount");
      return;
    }
    const started = beginBet({ game: "Blackjack (MP)", wager });
    if ("error" in started) {
      setErr(started.error);
      return;
    }
    await post("bet", { amount: wager, betNonce: started.nonce });
  };

  return (
    <div className="flex flex-col gap-4">
      {targetPopup.open && state ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
          <div className="glass glass-shine w-full max-w-[520px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Choose target</div>
                <div className="mt-1 text-xs text-white/60 font-mono">{targetPopup.specialId}</div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setTargetPopup({ open: false, specialId: null, target: null })}
              >
                Cancel
              </button>
            </div>

            <div className="mt-4">
              <select
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-white/20"
                value={targetPopup.target ?? ""}
                onChange={(e) => setTargetPopup((p) => ({ ...p, target: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Select…</option>
                {targetPopup.specialId?.includes("MYTHIC") ? null : <option value={-1}>Dealer</option>}
                {state.seats
                  .filter(Boolean)
                  .map((p) => p!)
                  .map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.username}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40"
                disabled={targetPopup.target == null || !targetPopup.specialId}
                onClick={() => {
                  if (targetPopup.target == null || !targetPopup.specialId) return;
                  void post("action", {
                    type: "special",
                    specialId: targetPopup.specialId,
                    targetUserId: targetPopup.target,
                  });
                  setTargetPopup({ open: false, specialId: null, target: null });
                }}
              >
                Use powerup
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                onClick={() => setTargetPopup({ open: false, specialId: null, target: null })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <TurnQuickPanel
        show={!!state && !!mySeat}
        isMyTurn={!!isMyTurn}
        myBet={Number(mySeat?.bet ?? 0)}
        canSplit={canSplit}
        canHit={!mySeat?.busted}
        canDoubleDown={canDoubleDown}
        onHit={() => post("action", { type: "hit" })}
        onStand={() => post("action", { type: "stand" })}
        onDoubleDown={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "double_down", betNonce: started.nonce });
        }}
        onSplit={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "split", betNonce: started.nonce });
        }}
        dealerCards={state?.dealer?.cards ?? []}
        myCards={mySeat?.cards ?? []}
      />
      <div className="glass glass-shine rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{state?.name ?? "Blackjack Table"}</h2>
            <p className="mt-1 text-sm text-white/60">
              Table: <span className="font-mono">{safeTableId ?? "-"}</span> • Round{" "}
              <span className="font-mono">{state?.round ?? "-"}</span> • Phase{" "}
              <span className="font-mono">{state?.phase ?? "-"}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/casino/blackjack" className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10">
              Back to lobby
            </Link>
            <button
              type="button"
              className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              onClick={() => post("leave")}
            >
              Leave
            </button>
          </div>
        </div>
        {err ? <div className="mt-3 text-sm text-rose-200">{err}</div> : null}
      </div>

      {!state ? (
        <div className="glass-soft rounded-3xl p-5 text-white/70">
          {err ? (
            <>
              <div className="text-sm font-semibold text-rose-200">{err}</div>
              <div className="mt-2 text-xs text-white/55">If this persists, the Master Debug overlay (bottom-left) will show dbSource + knownTables.</div>
            </>
          ) : (
            "Loading…"
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div className="glass-soft glass-shine rounded-3xl p-5">
            <p className="text-sm font-medium text-white">Round controls</p>
            <div className="mt-3 text-xs text-white/60">
              {state.phase === "betting" ? (
                <>Betting ends in <span className="font-mono text-white/80">{bettingLeft}s</span></>
              ) : state.phase === "player_turns" ? (
                <>Turn ends in <span className="font-mono text-white/80">{turnLeft}s</span></>
              ) : state.phase === "dealer_window" ? (
                <>Dealer window <span className="font-mono text-white/80">{dealerLeft}s</span></>
              ) : (
                <>In progress…</>
              )}
            </div>

            {mySeat ? (
              <>
                <label className="mt-4 block text-xs text-white/60">Bet amount (ⓒ)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={state.phase !== "betting"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={state.phase !== "betting"}
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                    onClick={placeBetWithWallet}
                  >
                    Place bet
                  </button>
                  <button
                    type="button"
                    disabled={state.phase !== "betting"}
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                    onClick={() => post("skip")}
                  >
                    Skip round
                  </button>
                </div>

                {state.peekCard != null ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    Peek:{" "}
                    <span className="font-mono text-white/90">
                      {state.peekCard < 0 ? "None" : `${cardFromIndex(state.peekCard).rank}${cardFromIndex(state.peekCard).suit}`}
                    </span>
                  </div>
                ) : null}

                {state.lastResult ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    Last result: <span className="text-white/90">{state.lastResult.outcome}</span> •{" "}
                    <span className="font-mono text-white/90">{state.lastResult.multiplier.toFixed(2)}x</span>
                  </div>
                ) : null}

                <div className="mt-5">
                  <p className="text-xs font-medium text-white/70">Specials</p>
                  {state.meInventory ? (
                    <div className="mt-2 text-[11px] text-white/55">
                      Hands played: <span className="font-mono text-white/80">{state.meInventory.handsPlayed ?? 0}</span>{" "}
                      • Next box in{" "}
                      <span className="font-mono text-white/80">
                        {(() => {
                          const hp = Number(state.meInventory.handsPlayed ?? 0);
                          const rem = hp % 3;
                          return rem === 0 ? 3 : 3 - rem;
                        })()}
                      </span>{" "}
                      hands
                    </div>
                  ) : null}
                  {Array.isArray(state.meInventory?.lastBox) && state.meInventory.lastBox.length ? (
                    <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                      Mystery Box: <span className="font-mono">{state.meInventory.lastBox.join(", ")}</span>
                    </div>
                  ) : null}
                  <label className="mt-2 block text-[11px] text-white/55">Target (for rare/magic cards)</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-white/20"
                    value={targetUserId ?? ""}
                    onChange={(e) => setTargetUserId(e.target.value ? Number(e.target.value) : null)}
                    disabled={!canUseAnytimeSpecial}
                  >
                    <option value="">(auto)</option>
                    <option value={-1}>Dealer</option>
                    {state.seats
                      .filter(Boolean)
                      .map((p) => p!)
                      .map((p) => (
                        <option key={p.userId} value={p.userId}>
                          {p.username}
                        </option>
                      ))}
                  </select>
                  {(() => {
                    const inv = state.meInventory;
                    const cats = inv?.categories;
                    const catOrder: Array<{ id: string; label: string }> = [
                      { id: "boosts", label: "Boosts" },
                      { id: "saves", label: "Saves" },
                      { id: "utility", label: "Utility" },
                      { id: "magic", label: "Magic" },
                      { id: "mythic", label: "Mythic" },
                      { id: "dealer", label: "Dealer" },
                    ];

                    const groups: Array<{ label: string; items: Array<[string, number]> }> = [];

                    if (cats && typeof cats === "object") {
                      for (const c of catOrder) {
                        const entries = Object.entries(cats[c.id] ?? {}).filter(([, v]: any) => Number(v) > 0) as Array<
                          [string, number]
                        >;
                        if (entries.length) groups.push({ label: c.label, items: entries });
                      }
                    } else if (inv && typeof inv === "object") {
                      const entries = Object.entries(inv)
                        .filter(([, v]) => typeof v === "number" && v > 0)
                        .map(([k, v]) => [k, v as number] as [string, number]);
                      groups.push({ label: "Inventory", items: entries });
                    }

                    if (groups.length === 0) {
                      return <div className="mt-2 text-xs text-white/50">No powerups yet.</div>;
                    }

                    return (
                      <div className="mt-2 flex flex-col gap-3">
                        {groups.map((g) => (
                          <div key={g.label}>
                            <div className="mb-2 text-[11px] font-semibold text-white/60">{g.label}</div>
                            <div className="grid grid-cols-2 gap-2">
                              {g.items.map(([k, v]) => {
                                const isDealerWindowCard =
                                  k.includes("DEALER") && !k.includes("TARGET") && !k.includes("MAGIC");
                                const isAnytimeCard = k.includes("TARGET") || k.includes("MAGIC") || k.includes("MYTHIC");
                                const isBettingCard = k === "BJ_PROTECTOR";
                                const enabled =
                                  v > 0 &&
                                  (isDealerWindowCard
                                    ? !!canUseDealerSpecial
                                    : isAnytimeCard
                                      ? !!canUseAnytimeSpecial
                                      : isBettingCard
                                        ? state?.phase === "betting"
                                        : !!isMyTurn);
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                                    disabled={!enabled}
                                    onClick={() => {
                                      if (isAnytimeCard) {
                                        // Force explicit target choice via popup.
                                        setTargetPopup({ open: true, specialId: k, target: null });
                                        return;
                                      }
                                      void post("action", {
                                        type: "special",
                                        specialId: k,
                                        targetUserId: null,
                                      });
                                    }}
                                    title="Use powerup"
                                  >
                                    <div className="font-semibold text-white">{k}</div>
                                    <div className="mt-1 text-white/60">x{v}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="mt-2 text-[11px] text-white/50">
                    Common cards usually work only on your turn. Rare “TARGET” / “MAGIC” cards can be played any time before the end of the round.
                    Stacking is allowed. Use “-1/-2/-5/-10” on your turn to save yourself from bust before your turn ends.
                  </div>
                </div>

                {isMyTurn ? (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-white/70">Your turn</p>
                    {mySeat?.busted ? (
                      <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                        BUSTED — play a save card (-1/-2/-5/-10) before your turn ends, or Stand to accept bust.
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                        onClick={() => post("action", { type: "hit" })}
                        disabled={!!mySeat?.busted}
                      >
                        Hit
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                        onClick={() => post("action", { type: "stand" })}
                      >
                        Stand
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                        onClick={() => post("action", { type: "vote_skip" })}
                        title="Skip the remaining turn timer"
                      >
                        Vote skip timer
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                        onClick={() => post("action", { type: "extend_timer" })}
                        disabled={!!mySeat?.extendUsedThisTurn}
                        title="Extend your turn timer once"
                      >
                        Extend timer
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 text-[11px] text-white/55">
                  Missed rounds: <span className="font-mono">{mySeat.missedRounds}</span>/5
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                  onClick={() => join(false)}
                >
                  Join (seat)
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                  onClick={() => join(true)}
                >
                  Spectate
                </button>
              </div>
            )}
          </div>

          <div className="glass-soft glass-shine rounded-3xl p-5">
            <p className="text-sm font-medium text-white">Table</p>

            <div className="mt-4">
              <p className="text-xs text-white/60">Dealer</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.dealer.cards.map((c, i) => (
                  <CardView key={i} idx={c} hidden={c < 0} />
                ))}
              </div>
              <p className="mt-2 text-xs text-white/55">
                Visible total: <span className="font-mono text-white/80">{dealerTotal}</span>
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs text-white/60">Seats</p>
              <div className="mt-2 grid grid-cols-1 gap-3">
                {state.seats.map((p, i) => {
                  if (!p) {
                    return (
                      <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
                        Seat {i + 1}: empty
                      </div>
                    );
                  }
                  const hv = handValue(p.cards, p.bonusPoints);
                  const isTurn = state.phase === "player_turns" && myTurnSeat === i;
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${isTurn ? "ring-2 ring-emerald-300/50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">
                          {p.username} <span className="text-xs text-white/50">#{i + 1}</span>
                        </div>
                        <div className="text-xs text-white/60">
                          Bet: <span className="font-mono text-white/80">{p.bet.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.cards.map((c, idx) => (
                          <CardView key={idx} idx={c} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/60">
                        Total: <span className="font-mono text-white/80">{hv.total}</span>
                        {hv.soft ? <span className="ml-2 text-white/45">(soft)</span> : null}
                        {p.bonusPoints ? (
                          <span className="ml-2 text-amber-200">(+{p.bonusPoints})</span>
                        ) : null}
                        {p.busted ? <span className="ml-2 text-rose-200">BUST</span> : null}
                        {p.stood ? <span className="ml-2 text-white/45">STAND</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-white/55">
                Spectators: <span className="font-mono">{state.spectators.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
