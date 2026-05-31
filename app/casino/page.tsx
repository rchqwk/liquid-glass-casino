import Link from "next/link";

const cards = [
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
    title: "Slots",
    desc: "Simple 3×1 slot machine with a small pay table.",
    href: "/casino/slots",
  },
  {
    title: "Blackjack",
    desc: "Basic blackjack vs dealer. No splits/double (prototype).",
    href: "/casino/blackjack",
  },
];

export default function CasinoLobbyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Lobby</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Choose a game. This is a play-money prototype with a “provably fair”
          style RNG flow (commit → reveal) for demo purposes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
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
    </div>
  );
}

