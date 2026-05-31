"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../lib/wallet";
import { useAuth } from "../lib/authClient";

export function Topbar() {
  const { balance, deposit, reset, refill5000AvailableAt, refill100AvailableAt } = useWallet();
  const { user, loading } = useAuth();
  const role = user?.role_level ?? 0;
  const [msg, setMsg] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => (x + 1) % 1000000), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const refillCooldownMs = Math.max(0, refill5000AvailableAt - now);
  const refill100CooldownMs = Math.max(0, refill100AvailableAt - now);
  const refillLabel = useMemo(() => {
    if (role >= 1) return "+5000";
    if (refillCooldownMs <= 0) return "+5000";
    const s = Math.ceil(refillCooldownMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `+5000 (${mm}:${ss})`;
  }, [refillCooldownMs, role]);

  const refill100Label = useMemo(() => {
    if (role >= 1) return "+100";
    if (refill100CooldownMs <= 0) return "+100";
    const s = Math.ceil(refill100CooldownMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `+100 (${mm}:${ss})`;
  }, [refill100CooldownMs, role]);

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
            onClick={() => {
              setMsg(null);
              const res = deposit(100, { bypassCooldown: role >= 1 });
              if (!res.ok) {
                setMsg(
                  res.nextAvailableAt
                    ? `Refill available in ${Math.ceil((res.nextAvailableAt - Date.now()) / 1000)}s.`
                    : res.error,
                );
              }
            }}
            disabled={role < 1 && refill100CooldownMs > 0}
            type="button"
          >
            {refill100Label}
          </button>
          <button
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
            onClick={() => {
              setMsg(null);
              const res = deposit(5000, { bypassCooldown: role >= 1 });
              if (!res.ok) {
                setMsg(
                  res.nextAvailableAt
                    ? `Refill available in ${Math.ceil((res.nextAvailableAt - Date.now()) / 60000)} min.`
                    : res.error,
                );
              }
            }}
            disabled={role < 1 && refillCooldownMs > 0}
            type="button"
            title={role < 1 ? "Standard users: one +5000 refill every 15 minutes" : "Admin: unlimited refills"}
          >
            {refillLabel}
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
      {msg ? (
        <div className="px-1 pt-2 text-xs text-white/60">{msg}</div>
      ) : null}
    </header>
  );
}
