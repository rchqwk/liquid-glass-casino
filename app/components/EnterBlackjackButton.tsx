"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function EnterBlackjackButton() {
  const [players, setPlayers] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/blackjack/discord-count", { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as any;
        if (cancelled) return;
        setPlayers(Math.max(0, Math.floor(Number(j?.players ?? 0) || 0)));
      } catch {
        // ignore
      }
    };
    void tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <Link
      className="glass-soft glass-shine relative inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
      href="/casino/blackjack-v2"
    >
      Enter Blackjack V2
      {players > 0 ? (
        <span
          title={`${players} player(s) in Discord blackjack right now`}
          className="absolute -right-2 -top-2 inline-flex min-w-[28px] items-center justify-center rounded-full border border-white/15 bg-rose-500/80 px-2 py-1 text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.35)]"
        >
          {players}
        </span>
      ) : null}
    </Link>
  );
}
