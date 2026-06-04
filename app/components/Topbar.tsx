"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../lib/wallet";
import { useAuth } from "../lib/authClient";

export function Topbar() {
  const { balance, deposit, reset, refill5000AvailableAt, refill100AvailableAt } = useWallet();
  const { user, loading, refresh } = useAuth();
  const role = user?.role_level ?? 0;
  const [barOpen, setBarOpen] = useState(false);
  const autoHideTimerRef = useRef<number | null>(null);
  const [prestigeBusy, setPrestigeBusy] = useState(false);
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

  // Auto-hide the expanded top bar after 5s of no cursor/activity.
  useEffect(() => {
    if (!barOpen) return;
    const resetTimer = () => {
      if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = window.setTimeout(() => setBarOpen(false), 5000) as any;
    };
    resetTimer();
    window.addEventListener("mousemove", resetTimer, { passive: true });
    window.addEventListener("mousedown", resetTimer, { passive: true });
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("touchstart", resetTimer, { passive: true });
    window.addEventListener("scroll", resetTimer, { passive: true });
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("mousedown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      if (autoHideTimerRef.current) window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    };
  }, [barOpen]);

  // Expose topbar open/closed state globally so pages can synchronize secondary headers.
  useEffect(() => {
    try {
      if (typeof document === "undefined") return;
      const v = barOpen ? "1" : "0";
      document.documentElement.dataset.lgcTopbarOpen = v;
      window.dispatchEvent(new CustomEvent("lgc:topbar", { detail: { open: barOpen } }));
    } catch {
      // ignore
    }
  }, [barOpen]);

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
  const prestigeLevel = Number((user as any)?.prestige_level ?? 0);
  const canClaimPrestige1 = !!user && Number(balance ?? 0) >= 1_000_000_000 && prestigeLevel < 1;
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
    <>
      {/* Prestige bubble (shows when eligible) */}
      {!barOpen && canClaimPrestige1 ? (
        <div className="fixed top-3 left-3 z-[75]">
          <button
            type="button"
            disabled={prestigeBusy}
            className="glass glass-shine rounded-3xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-3 text-left text-xs text-yellow-100 shadow-[0_0_30px_rgba(250,204,21,.18)] hover:bg-yellow-500/15 disabled:opacity-40"
            onClick={async () => {
              if (prestigeBusy) return;
              setPrestigeBusy(true);
              setMsg(null);
              try {
                const res = await fetch("/api/customizations", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ claimPrestige1: true }),
                });
                const j = (await res.json().catch(() => ({}))) as any;
                if (!res.ok) throw new Error(j?.error ?? "Failed");
                await refresh();
                setMsg("Prestige 1 unlocked.");
              } catch (e: any) {
                setMsg(String(e?.message ?? "Failed"));
              } finally {
                setPrestigeBusy(false);
              }
            }}
            title="Unlock Prestige 1"
          >
            <div className="text-[11px] text-yellow-200/80">Prestige ready</div>
            <div className="mt-0.5 text-sm font-semibold">Prestige 1 ★</div>
          </button>
        </div>
      ) : null}

      {/* Floating balance bubble (always visible) */}
      {!barOpen ? (
        <div className="fixed top-3 right-3 z-[75]">
          <button
            type="button"
            className="glass glass-shine rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
            onClick={() => setBarOpen(true)}
            title="Toggle top bar"
          >
            <div className="text-[11px] text-white/60">Balance</div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-white/90">{displayBalance.toFixed(2)} ⓒ</div>
          </button>
        </div>
      ) : null}

      {barOpen ? (
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
              <span className="hidden text-xs text-white/55 sm:inline">Play-money prototype</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                className="hidden rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white sm:inline"
                href="/casino/leaderboard"
              >
                Leaderboard
              </Link>
              <Link
                className="rounded-2xl px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white"
                href="/casino/customizations"
              >
                Customizations
              </Link>
              <Link
                className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
                href="/casino/profile"
              >
                {loading ? "…" : user ? `@${user.username}` : "Sign in"}
              </Link>
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
          {msg ? <div className="px-1 pt-2 text-xs text-white/60">{msg}</div> : null}
          {broadcast ? (
            <div className="px-1 pt-2">
              <div className="glass-soft glass-shine rounded-2xl border border-white/10 px-3 py-2 text-xs text-white/80">
                {broadcast}
              </div>
            </div>
          ) : null}
        </header>
      ) : null}
    </>
  );
}
