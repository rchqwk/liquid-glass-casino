"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../lib/wallet";
import { useAuth } from "../lib/authClient";

export function Topbar() {
  const { balance, deposit, reset, refill5000AvailableAt, refill100AvailableAt } = useWallet();
  const { user, loading } = useAuth();
  const role = user?.role_level ?? 0;
  const [msg, setMsg] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState<string | null>(null);
  const [displayBalance, setDisplayBalance] = useState(balance);
  const displayBalanceRef = useRef(displayBalance);
  const [afterId, setAfterId] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("lgc.ann.afterId");
      return raw ? Number(raw) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((x) => (x + 1) % 1000000), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    displayBalanceRef.current = displayBalance;
  }, [displayBalance]);

  // Animate balance changes to count up/down smoothly.
  useEffect(() => {
    const target = Number(balance ?? 0);
    if (!Number.isFinite(target)) return;
    // jump on first render
    setDisplayBalance((prev) => (prev == null ? target : prev));
    let raf = 0;
    const start = performance.now();
    const from = Number(displayBalanceRef.current ?? target);
    const duration = 650; // ms
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = from + (target - from) * eased;
      setDisplayBalance(Math.round(v * 100) / 100);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/announcements?after=${afterId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { announcements?: Array<{ id: number; message: string }> };
        const list = data.announcements ?? [];
        if (cancelled || list.length === 0) return;
        const last = list[list.length - 1]!;
        setAfterId(last.id);
        try {
          localStorage.setItem("lgc.ann.afterId", String(last.id));
        } catch {
          // ignore
        }
        setBroadcast(last.message);
        window.setTimeout(() => {
          if (!cancelled) setBroadcast(null);
        }, 4500);
      } catch {
        // ignore
      }
    };
    const id = window.setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [afterId]);

  const now = Date.now();
  const refillCooldownMs = Math.max(0, refill5000AvailableAt - now);
  const refill100CooldownMs = Math.max(0, refill100AvailableAt - now);
  const canRefill = !loading && !!user;
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
          <Link
            href="/casino"
            className="glass-soft inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
            title="Home"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Home
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
              {displayBalance.toFixed(2)} ⓒ
            </span>
          </div>
          <button
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
            onClick={() => {
              setMsg(null);
              if (!canRefill) {
                setMsg("Sign in to refill.");
                return;
              }
              const res = deposit(100, { bypassCooldown: role >= 1 });
              if (!res.ok) {
                setMsg(
                  res.nextAvailableAt
                    ? `Refill available in ${Math.ceil((res.nextAvailableAt - Date.now()) / 1000)}s.`
                    : res.error,
                );
              }
            }}
            disabled={!canRefill || (role < 1 && refill100CooldownMs > 0)}
            type="button"
          >
            {refill100Label}
          </button>
          <button
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
            onClick={() => {
              setMsg(null);
              if (!canRefill) {
                setMsg("Sign in to refill.");
                return;
              }
              const res = deposit(5000, { bypassCooldown: role >= 1 });
              if (!res.ok) {
                setMsg(
                  res.nextAvailableAt
                    ? `Refill available in ${Math.ceil((res.nextAvailableAt - Date.now()) / 60000)} min.`
                    : res.error,
                );
              }
            }}
            disabled={!canRefill || (role < 1 && refillCooldownMs > 0)}
            type="button"
            title={role < 1 ? "Standard users: one +5000 refill every 15 minutes" : "Admin: unlimited refills"}
          >
            {refillLabel}
          </button>
          {role >= 1 ? (
            <button
              className="rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white"
              onClick={reset}
              type="button"
              title="Reset wallet + RNG seeds"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
      {msg ? (
        <div className="px-1 pt-2 text-xs text-white/60">{msg}</div>
      ) : null}
      {broadcast ? (
        <div className="px-1 pt-2">
          <div className="glass-soft glass-shine rounded-2xl border border-white/10 px-3 py-2 text-xs text-white/80">
            {broadcast}
          </div>
        </div>
      ) : null}
    </header>
  );
}
