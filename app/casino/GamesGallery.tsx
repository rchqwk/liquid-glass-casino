"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type GameCard = {
  gameId: string;
  title: string;
  desc: string;
  href: string;
  tag?: string;
};

type StatRow = { gameId: string; wagerTotal: number; bets: number };

const GAMES: GameCard[] = [
  {
    gameId: "slots",
    title: "EMOJI Hold and Win",
    desc: "5×3 emoji slot with hold/nudge + buy options.",
    href: "/casino/slots",
    tag: "BUY FS & FEATURE",
  },
  {
    gameId: "slots-5x5",
    title: "Fruit Bowl Super Ways",
    desc: "5×5 super-ways fruit slot.",
    href: "/casino/slots-5x5",
    tag: "BUY FS & FEATURE",
  },
  {
    gameId: "slots-10x10",
    title: "Break Bonanza",
    desc: "10×10 cascading cluster break + chaining.",
    href: "/casino/slots-10x10",
    tag: "BUY FS & FEATURE",
  },
  { gameId: "dice", title: "Dice", desc: "Pick a target and roll under.", href: "/casino/dice" },
  { gameId: "roulette", title: "Roulette", desc: "European (0–36).", href: "/casino/roulette" },
  { gameId: "blackjack", title: "Arcade Blackjack", desc: "Basic blackjack (prototype).", href: "/casino/blackjack", tag: "UP TO 10 PLAYERS" },
  { gameId: "poker", title: "Poker", desc: "Prototype poker page.", href: "/casino/poker" },
];

function money(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

export function GamesGallery() {
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [totalWagered, setTotalWagered] = useState(0);
  const [sortBy, setSortBy] = useState<"wager" | "bets">(() => {
    try {
      const raw = localStorage.getItem("lgc.games.sortBy");
      return raw === "bets" ? "bets" : "wager";
    } catch {
      return "wager";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("lgc.games.sortBy", sortBy);
    } catch {
      // ignore
    }
  }, [sortBy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/game-stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { stats?: StatRow[]; totalWagered?: number };
        if (cancelled) return;
        const byId: Record<string, StatRow> = {};
        for (const r of data.stats ?? []) byId[r.gameId] = r;
        setStats(byId);
        setTotalWagered(Number(data.totalWagered ?? 0));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const withStats = GAMES.map((g) => {
      const s = stats[g.gameId];
      return {
        ...g,
        bets: s?.bets ?? 0,
        wagerTotal: s?.wagerTotal ?? 0,
      };
    });
    withStats.sort((a, b) => {
      const ka = sortBy === "bets" ? a.bets : a.wagerTotal;
      const kb = sortBy === "bets" ? b.bets : b.wagerTotal;
      return kb - ka;
    });
    return withStats;
  }, [stats, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Games</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Browse the active games. Sort by total bets or total wagered.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
            Total wagered (all games):{" "}
            <span className="ml-2 font-mono font-semibold text-white">{money(totalWagered)} ⓒ</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                sortBy === "wager" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
              onClick={() => setSortBy("wager")}
            >
              Sort: Total wagered
            </button>
            <button
              type="button"
              className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                sortBy === "bets" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
              onClick={() => setSortBy("bets")}
            >
              Sort: Total bets
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sorted.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glass-soft glass-shine rounded-3xl p-5 transition hover:bg-white/10"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{c.title}</h3>
              <span className="text-xs text-white/60">Open</span>
            </div>
            {c.tag ? (
              <div className="mt-2">
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white/75">
                  {c.tag}
                </span>
              </div>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-white/70">{c.desc}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-white/60">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Bets: <span className="font-mono text-white/80">{c.bets}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Wagered: <span className="font-mono text-white/80">{money(c.wagerTotal)} ⓒ</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/casino/leaderboard"
          className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
        >
          Leaderboard
        </Link>
        <Link
          href="/casino/profile"
          className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
        >
          Profile
        </Link>
        <Link
          href="/casino/settings"
          className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
