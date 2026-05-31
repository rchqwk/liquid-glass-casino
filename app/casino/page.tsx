import Link from "next/link";
import { getTotalWagered } from "../lib/db";

const games = [
  {
    title: "Slots",
    desc: "5×3 emoji slot with hold/nudge, features, and buy options.",
    href: "/casino/slots",
  },
  {
    title: "Slots 5×5 Deluxe",
    desc: "5×5 reel-strip slot with CC0 icons + lucky/buy features.",
    href: "/casino/slots-5x5",
  },
  {
    title: "Slots 10×10 Cascading",
    desc: "Cluster break + drop + chaining (big swings in features).",
    href: "/casino/slots-10x10",
  },
  {
    title: "Dice",
    desc: "Pick a target and roll under. Fast MVP odds game.",
    href: "/casino/dice",
  },
  {
    title: "Roulette",
    desc: "European (0–36). Bet red/black or a number.",
    href: "/casino/roulette",
  },
  {
    title: "Blackjack",
    desc: "Basic blackjack vs dealer (prototype).",
    href: "/casino/blackjack",
  },
  {
    title: "Poker",
    desc: "Prototype poker page.",
    href: "/casino/poker",
  },
];

export default async function CasinoLobbyPage() {
  const totalWagered = await getTotalWagered();
  return (
    <div className="flex flex-col gap-6">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Games</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Browse the active games. This is a play-money prototype with a “provably fair”
          style RNG flow (commit → reveal) for demo purposes.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
          Total wagered (all players):{" "}
          <span className="ml-2 font-mono font-semibold text-white">
            {totalWagered.toFixed(2)} ⓒ
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {games.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glass-soft glass-shine rounded-3xl p-5 transition hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{c.title}</h3>
              <span className="text-xs text-white/60">Open</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/70">{c.desc}</p>
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
