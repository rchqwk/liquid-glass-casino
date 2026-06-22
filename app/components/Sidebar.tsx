"use client";

import Link from "next/link";
import { useAuth } from "../lib/authClient";

const nav = [
  { href: "/casino/blackjack-v2", label: "Blackjack" },
  { href: "/casino/legacy", label: "Legacy Casino" },
  { href: "/casino/dice", label: "Dice" },
  { href: "/casino/roulette", label: "Roulette" },
  { href: "/casino/slots", label: "EMOJI Hold and Win" },
  { href: "/casino/slots-5x5", label: "Fruit Bowl Super Ways" },
  { href: "/casino/slots-10x10", label: "Break Bonanza" },
  { href: "/casino/poker", label: "Poker" },
  { href: "/casino/leaderboard", label: "Leaderboard" },
  { href: "/casino/profile", label: "Profile" },
  { href: "/casino/settings", label: "Settings" },
];

export function Sidebar() {
  const { user } = useAuth();
  const canSeeAdmin = (user?.role_level ?? 0) >= 1;

  return (
    <aside className="hidden w-[260px] shrink-0 p-4 sm:block">
      <div className="glass glass-shine h-full rounded-3xl p-4">
        <div className="mb-4 rounded-2xl px-3 py-3">
          <p className="text-xs tracking-wide text-white/60">Liquid Glass</p>
          <p className="text-lg font-semibold text-white">Casino</p>
        </div>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-soft glass-shine rounded-2xl px-3 py-2.5 text-sm text-white/80 transition hover:text-white hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
          {canSeeAdmin ? (
            <Link
              href="/casino/admin"
              className="glass-soft glass-shine rounded-2xl px-3 py-2.5 text-sm text-white/80 transition hover:text-white hover:bg-white/10"
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="mt-6 rounded-2xl border border-white/10 p-3 text-xs text-white/55">
          <p className="font-medium text-white/70">Play-money only</p>
          <p className="mt-1 leading-5">
            Local wallet + RNG demo. No real deposits or payouts.
          </p>
        </div>
      </div>
    </aside>
  );
}
