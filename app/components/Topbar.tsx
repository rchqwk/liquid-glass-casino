"use client";

import Link from "next/link";
import { useWallet } from "../lib/wallet";
import { useAuth } from "../lib/authClient";

export function Topbar() {
  const { balance, deposit, reset } = useWallet();
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6">
      <div className="glass glass-shine flex items-center justify-between gap-3 rounded-3xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-sm font-semibold text-white">
            Casino
          </Link>
          <span className="hidden text-xs text-white/55 sm:inline">
            Play-money prototype
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="hidden rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white sm:inline"
            href="/casino/leaderboard"
          >
            Leaderboard
          </Link>
          <Link
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
            href="/casino/profile"
          >
            {loading ? "…" : user ? `@${user.username}` : "Sign in"}
          </Link>
          <div className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80">
            Balance{" "}
            <span className="ml-2 font-semibold text-white">
              {balance.toFixed(2)} ⓒ
            </span>
          </div>
          <button
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
            onClick={() => deposit(100)}
            type="button"
          >
            +100
          </button>
          <button
            className="rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white"
            onClick={reset}
            type="button"
            title="Reset wallet + RNG seeds"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
