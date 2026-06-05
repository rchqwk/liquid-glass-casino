"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

export type TourStep = {
  page: "blackjack_lobby" | "blackjack_table";
  selector?: string; // optional; if missing, center the bubble
  title: string;
  body: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TourOverlay({ steps }: { steps: TourStep[] }) {
  const pathname = usePathname();
  const page: TourStep["page"] | null = useMemo(() => {
    if (!pathname) return null;
    if (pathname === "/casino/blackjack") return "blackjack_lobby";
    if (pathname.startsWith("/casino/blackjack/") && pathname !== "/casino/blackjack/discord") return "blackjack_table";
    return null;
  }, [pathname]);

  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Load tour state.
  useEffect(() => {
    try {
      setActive(sessionStorage.getItem("lgc.tour.active") === "1");
      setStepIdx(Math.max(0, Number(sessionStorage.getItem("lgc.tour.step") ?? "0") || 0));
    } catch {
      setActive(false);
    }
  }, [pathname]);

  // Update highlight rect.
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step || !page || step.page !== page) {
      setRect(null);
      return;
    }
    const update = () => {
      try {
        if (!step.selector) {
          setRect(null);
          return;
        }
        const el = document.querySelector(step.selector) as HTMLElement | null;
        if (!el) {
          setRect(null);
          return;
        }
        setRect(el.getBoundingClientRect());
      } catch {
        setRect(null);
      }
    };
    update();
    const id = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, stepIdx, steps, page]);

  const step = steps[stepIdx] ?? null;
  if (!active || !step || !page) return null;

  // If the next step is for a different page, show a centered instruction.
  const onThisPage = step.page === page;

  const bubblePos = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    if (!onThisPage || !rect) {
      return { left: vw / 2, top: vh / 2, align: "center" as const };
    }
    const pad = 14;
    const preferAbove = rect.top > vh * 0.55;
    const top = preferAbove ? rect.top - pad : rect.bottom + pad;
    const left = rect.left + rect.width / 2;
    return {
      left: clamp(left, 180, vw - 180),
      top: clamp(top, 80, vh - 160),
      align: preferAbove ? ("above" as const) : ("below" as const),
    };
  }, [onThisPage, rect]);

  const goTo = (idx: number) => {
    const next = clamp(idx, 0, steps.length - 1);
    setStepIdx(next);
    try {
      sessionStorage.setItem("lgc.tour.step", String(next));
    } catch {
      // ignore
    }
  };

  const stop = () => {
    setActive(false);
    try {
      sessionStorage.removeItem("lgc.tour.active");
      sessionStorage.removeItem("lgc.tour.step");
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[96] pointer-events-none">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />

      {onThisPage && rect ? (
        <div
          className="absolute rounded-2xl border-2 border-emerald-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,.55),0_20px_60px_rgba(0,0,0,.45)]"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}

      <div
        className="absolute w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 pointer-events-auto"
        style={{ left: bubblePos.left, top: bubblePos.top }}
      >
        <div className="relative glass glass-shine rounded-3xl border border-white/10 p-5 text-white/85">
          {onThisPage && rect && bubblePos.align !== "center" ? (
            <div
              className="absolute left-1/2 h-0 w-0 -translate-x-1/2"
              style={
                bubblePos.align === "above"
                  ? {
                      bottom: -10,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderTop: "10px solid rgba(255,255,255,.14)",
                    }
                  : {
                      top: -10,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderBottom: "10px solid rgba(255,255,255,.14)",
                    }
              }
            />
          ) : null}
          <div className="text-sm font-semibold text-white">{step.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{step.body}</div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-2xl px-3 py-2 text-xs font-semibold text-white/60 hover:text-white"
              onClick={stop}
            >
              Skip tutorial
            </button>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/45">
                {stepIdx + 1}/{steps.length}
              </div>
              <button
                type="button"
                className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
                onClick={() => goTo(stepIdx - 1)}
                disabled={stepIdx <= 0}
              >
                Back
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15"
                onClick={() => (stepIdx >= steps.length - 1 ? stop() : goTo(stepIdx + 1))}
              >
                {stepIdx >= steps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
