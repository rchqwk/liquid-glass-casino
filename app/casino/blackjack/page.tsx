"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../../lib/wallet";
import { useAuth } from "../../lib/authClient";

type Card = {
  rank: string;
  suit: "♠" | "♥" | "♦" | "♣";
  value: number; // for non-ace
};

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r];
  if (rank === "A") return { rank, suit, value: 1 };
  if (["J", "Q", "K"].includes(rank)) return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  // Add aces as 1 then upgrade to 11 when possible
  total += aces; // all aces as 1
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  return { total, soft };
}

function CardView({ card, hidden }: { card: Card; hidden?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className={`relative flex h-24 w-16 select-none items-center justify-center rounded-2xl border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,.35)] ${
        hidden ? "bg-white/10" : "bg-white/90"
      } animate-[cardIn_.22s_ease-out]`}
    >
      {hidden ? (
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      ) : (
        <>
          <div
            className={`absolute left-2 top-2 text-xs font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}
          >
            {card.rank}
            <div className="text-[10px] leading-3">{card.suit}</div>
          </div>
          <div className={`text-2xl ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
            {card.suit}
          </div>
          <div
            className={`absolute bottom-2 right-2 rotate-180 text-xs font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}
          >
            {card.rank}
            <div className="text-[10px] leading-3">{card.suit}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BlackjackPage() {
  const { beginBet, settleBet, balance } = useWallet();
  const { reportResult } = useAuth();
  const [wager, setWager] = useState(10);

  const [phase, setPhase] = useState<
    "idle" | "player" | "dealer" | "done"
  >("idle");
  const [betNonce, setBetNonce] = useState<number | null>(null);
  const [deck, setDeck] = useState<number[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [message, setMessage] = useState<string>("Place a wager to start.");
  const [settlement, setSettlement] = useState<{
    profit: number;
    outcome: string;
    multiplier: number;
  } | null>(null);

  const playerVal = useMemo(() => handValue(player), [player]);
  const dealerVal = useMemo(() => handValue(dealer), [dealer]);

  const draw = () => {
    setDeck((d) => {
      const copy = [...d];
      const next = copy.pop();
      if (next == null) return copy;
      // By convention, callers will read the drawn card using the return value below.
      return copy;
    });
  };

  const drawCardFromDeck = (d: number[]) => {
    const idx = d[d.length - 1];
    return { idx, nextDeck: d.slice(0, -1) };
  };

  const dealNewHand = () => {
    setSettlement(null);
    setMessage("");

    const started = beginBet({ game: "Blackjack", wager });
    if ("error" in started) {
      setMessage(started.error);
      return;
    }

    const n = started.nonce;
    setBetNonce(n);
    const rng = started.rng;

    // Deterministic shuffle (Fisher-Yates) driven by RNG.
    const d = Array.from({ length: 52 }, (_, i) => i);
    for (let i = d.length - 1; i > 0; i -= 1) {
      const j = rng.int(d.length - 1 - i, i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }

    // Initial deal: P, D, P, D
    let cur = d;
    const a1 = drawCardFromDeck(cur);
    cur = a1.nextDeck;
    const b1 = drawCardFromDeck(cur);
    cur = b1.nextDeck;
    const a2 = drawCardFromDeck(cur);
    cur = a2.nextDeck;
    const b2 = drawCardFromDeck(cur);
    cur = b2.nextDeck;

    const p = [cardFromIndex(a1.idx!), cardFromIndex(a2.idx!)];
    const dlr = [cardFromIndex(b1.idx!), cardFromIndex(b2.idx!)];

    setDeck(cur);
    setPlayer(p);
    setDealer(dlr);
    setPhase("player");
    setMessage("Your turn: Hit or Stand.");

    // Check for blackjack on deal
    const pBJ = handValue(p).total === 21;
    const dBJ = handValue(dlr).total === 21;
    if (pBJ || dBJ) {
      if (pBJ && dBJ) finishHand(1, "Push (both blackjack)");
      else if (pBJ) finishHand(2.5, "Blackjack! WIN (3:2)");
      else finishHand(0, "Dealer blackjack. LOSE");
    }
  };

  const finishHand = (multiplier: number, outcome: string) => {
    if (betNonce == null) return;
    const res = settleBet({ nonce: betNonce, multiplier, outcome });
    if ("error" in res) {
      setMessage(res.error);
      return;
    }
    setSettlement({ profit: res.profit, outcome: res.outcome, multiplier: res.multiplier });
    void reportResult({
      game: "Blackjack",
      profit: res.profit,
      wager,
      balance: res.balanceAfter,
    });
    setPhase("done");
    setMessage("Hand complete.");
    setBetNonce(null);
  };

  const onHit = () => {
    if (phase !== "player") return;
    setDeck((d) => {
      if (d.length === 0) return d;
      const { idx, nextDeck } = drawCardFromDeck(d);
      setPlayer((p) => [...p, cardFromIndex(idx!)]);
      return nextDeck;
    });
  };

  const onStand = () => {
    if (phase !== "player") return;
    setPhase("dealer");
    setMessage("Dealer’s turn…");
  };

  // Dealer logic loop (runs when phase becomes 'dealer')
  useEffect(() => {
    if (phase !== "dealer") return;

    const tick = () => {
      const pTotal = handValue(player).total;
      const dTotal = handValue(dealer).total;

      if (pTotal > 21) {
        finishHand(0, `Bust (${pTotal}). LOSE`);
        return;
      }

      if (dTotal < 17) {
        setDeck((d) => {
          if (d.length === 0) return d;
          const { idx, nextDeck } = drawCardFromDeck(d);
          setDealer((dlr) => [...dlr, cardFromIndex(idx!)]);
          return nextDeck;
        });
        return;
      }

      // Resolve
      if (dTotal > 21) {
        finishHand(2, `Dealer bust (${dTotal}). WIN`);
        return;
      }

      if (pTotal > dTotal) finishHand(2, `Player ${pTotal} > Dealer ${dTotal}. WIN`);
      else if (pTotal < dTotal) finishHand(0, `Player ${pTotal} < Dealer ${dTotal}. LOSE`);
      else finishHand(1, `Push (${pTotal})`);
    };

    const id = window.setTimeout(tick, 550);
    return () => window.clearTimeout(id);
  }, [phase, player, dealer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-bust check on player draws
  useEffect(() => {
    if (phase !== "player") return;
    const pTotal = playerVal.total;
    if (pTotal > 21) {
      finishHand(0, `Bust (${pTotal}). LOSE`);
    }
  }, [playerVal.total]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Blackjack</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Interactive blackjack with card graphics + simple deal animations.
          Prototype rules: no splits, doubles, or insurance. Dealer stands on all
          17s.
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

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
              type="button"
              onClick={dealNewHand}
              disabled={phase !== "idle" && phase !== "done"}
            >
              Deal
            </button>
            <button
              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
              type="button"
              onClick={onHit}
              disabled={phase !== "player"}
            >
              Hit
            </button>
            <button
              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
              type="button"
              onClick={onStand}
              disabled={phase !== "player"}
            >
              Stand
            </button>
          </div>

          <p className="mt-4 text-xs text-white/60">{message}</p>

          {settlement && (
            <div className="mt-4 rounded-2xl border border-white/10 p-3">
              <p className="text-xs font-medium text-white/70">Result</p>
              <p className="mt-1 text-sm text-white/85">{settlement.outcome}</p>
              <p className="mt-2 text-xs text-white/60">
                Profit{" "}
                <span
                  className={`font-mono ${settlement.profit >= 0 ? "text-emerald-200" : "text-rose-200"}`}
                >
                  {settlement.profit >= 0 ? "+" : ""}
                  {settlement.profit.toFixed(2)} ⓒ
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Table</p>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/70">Dealer</p>
              <p className="text-xs text-white/60">
                {phase === "player" ? "?" : dealerVal.total}{" "}
                {dealerVal.soft ? "(soft)" : ""}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {dealer.length === 0 ? (
                <div className="text-sm text-white/55">—</div>
              ) : (
                dealer.map((c, i) => (
                  <CardView
                    key={`${c.rank}${c.suit}${i}`}
                    card={c}
                    hidden={i === 1 && phase === "player"}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/70">Player</p>
              <p className="text-xs text-white/60">
                {playerVal.total} {playerVal.soft ? "(soft)" : ""}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {player.length === 0 ? (
                <div className="text-sm text-white/55">—</div>
              ) : (
                player.map((c, i) => (
                  <CardView key={`${c.rank}${c.suit}${i}`} card={c} />
                ))
              )}
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-5 text-white/55">
            Tip: For the cleanest “provably fair” story in production, the deck
            shuffle should happen server-side using a committed seed, then be
            revealed later. This prototype keeps everything local.
          </p>
        </div>
      </div>
    </div>
  );
}
