"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/authClient";

export function OnboardingTutorial() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => {
    const uid = user?.id ?? 0;
    return `lgc.tutorial.dismissed.v1.${uid || "anon"}`;
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // Don't show while already in the guided tour.
    try {
      if (sessionStorage.getItem("lgc.tour.active") === "1") return;
    } catch {
      // ignore
    }
    try {
      if (localStorage.getItem(storageKey) === "1") return;
    } catch {
      // ignore
    }
    // Only show in casino area (keeps it out of landing/terms/etc).
    if (!pathname?.startsWith("/casino")) return;
    setOpen(true);
  }, [loading, user, pathname, storageKey]);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const startTour = () => {
    try {
      sessionStorage.setItem("lgc.tour.active", "1");
      sessionStorage.setItem("lgc.tour.step", "0");
    } catch {
      // ignore
    }
    setOpen(false);
    // Start tour at the blackjack lobby so we can guide into a table.
    window.location.href = "/casino/blackjack-v2";
  };

  const openNewTab = (path: string) => {
    try {
      window.open(path, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = path;
    }
  };

  return (
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <div className="glass glass-shine w-full max-w-lg rounded-3xl border border-white/10 p-6 text-white/85">
          <div className="text-lg font-semibold text-white">Quick tutorial</div>
          <div className="mt-2 text-sm leading-6 text-white/70">
            Want a quick refresher? You can open the docs, or take an in-game tour that points out the most important features
            (powerups, mystery boxes, collectibles, and table controls).
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              onClick={() => openNewTab("/casino/blackjack/rules")}
            >
              Blackjack rules
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              onClick={() => openNewTab("/casino/blackjack/special-rules")}
            >
              Special rules
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              onClick={() => openNewTab("/casino/blackjack/strategy")}
            >
              Strategy guide
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-white/60 hover:text-white"
              onClick={dismiss}
            >
              I don’t need a tutorial
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
              onClick={startTour}
            >
              Show me around
            </button>
          </div>

          <div className="mt-4 text-[11px] text-white/50">
            Tip: You can always re-open these pages later from the Blackjack lobby.
          </div>
        </div>
      </div>
    </div>
  );
}
