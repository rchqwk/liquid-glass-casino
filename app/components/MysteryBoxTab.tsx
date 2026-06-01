"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/authClient";

type BoxesResp = {
  unopened: number;
  handsPlayed: number;
  tradePoints?: number;
  tradeCharges?: number;
  boxes: Array<{ id: string; tier?: string; awardedAt: number; opened: boolean; openedAt?: number; contents?: string[] }>;
};

type OpenResp =
  | { ok: true; unopened: number; box: { id: string; tier?: string; contents: string[]; rarity: string[] } }
  | { error: string };

function rarityClass(r: string) {
  if (r === "mythic") return "ring-2 ring-cyan-300/70 shadow-[0_0_34px_rgba(34,211,238,.25)]";
  if (r === "legendary") return "ring-2 ring-yellow-300/70 shadow-[0_0_30px_rgba(250,204,21,.35)]";
  if (r === "rare") return "ring-2 ring-fuchsia-300/60 shadow-[0_0_24px_rgba(232,121,249,.25)]";
  return "ring-1 ring-white/15 shadow-[0_0_18px_rgba(255,255,255,.10)]";
}

function rarityLabel(r: string) {
  if (r === "mythic") return "MYTHIC";
  if (r === "legendary") return "LEGENDARY";
  if (r === "rare") return "RARE";
  return "COMMON";
}

export function MysteryBoxTab() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isOnBlackjack = pathname?.startsWith("/casino/blackjack");

  const [data, setData] = useState<BoxesResp | null>(null);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [revealStep, setRevealStep] = useState(0);
  const [lastOpened, setLastOpened] = useState<{ contents: string[]; rarity: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const unopened = data?.unopened ?? 0;
  const tradePoints = data?.tradePoints ?? 0;

  useEffect(() => {
    if (!user || !isOnBlackjack) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/blackjack/boxes", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as BoxesResp;
        if (!cancelled) setData(j);
      } catch {
        // ignore
      }
    };
    const id = window.setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, isOnBlackjack]);

  const hasMythic = useMemo(() => (lastOpened?.rarity ?? []).includes("mythic"), [lastOpened]);
  const hasLegendary = useMemo(() => (lastOpened?.rarity ?? []).includes("legendary"), [lastOpened]);

  const openNextBox = async () => {
    if (opening) return;
    setErr(null);
    setOpening(true);
    setRevealStep(0);
    setLastOpened(null);
    try {
      const res = await fetch("/api/blackjack/boxes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as OpenResp;
      if (!res.ok || "error" in j) throw new Error("error" in j ? j.error : "Failed");

      setData((d) => (d ? { ...d, unopened: j.unopened } : d));

      // "Opening" animation delay
      window.setTimeout(() => {
        setLastOpened({ contents: j.box.contents, rarity: j.box.rarity });
        setRevealStep(1);
      }, 900);
    } catch (e: any) {
      setErr(String(e?.message ?? "Failed"));
      setOpening(false);
      return;
    }

    // staged reveal (rarer items reveal slower)
    window.setTimeout(() => setRevealStep(2), 1400);
    window.setTimeout(() => setRevealStep(3), 2000);
    window.setTimeout(() => setOpening(false), 2400);
  };

  const tradeBox = async (tier: "rare" | "mythic") => {
    setErr(null);
    try {
      const res = await fetch("/api/blackjack/boxes/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(j?.error ?? "Trade failed");
      // refresh
      const r2 = await fetch("/api/blackjack/boxes", { cache: "no-store" });
      if (r2.ok) setData((await r2.json()) as BoxesResp);
    } catch (e: any) {
      setErr(String(e?.message ?? "Trade failed"));
    }
  };

  if (!user || !isOnBlackjack) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes mb-pop {
          0% { transform: scale(.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mb-shake {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-2px) rotate(-1deg); }
          50% { transform: translateX(2px) rotate(1deg); }
          75% { transform: translateX(-2px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes mb-fanfare {
          0% { opacity: 0; transform: translateY(10px) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Floating tab */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[65]">
        <button
          type="button"
          className="pointer-events-auto glass glass-shine relative rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
          onClick={() => setOpen(true)}
        >
          <div className="font-semibold">Mystery Boxes</div>
          <div className="mt-1 text-[11px] text-white/60">Unopened: <span className="font-mono text-white/90">{unopened}</span></div>
          {unopened > 0 ? (
            <div className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-fuchsia-500 px-2 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,.35)]">
              {unopened}
            </div>
          ) : null}
        </button>
      </div>

      {/* Overlay */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Mystery Boxes</div>
                <div className="mt-1 text-xs text-white/60">
                  Unopened: <span className="font-mono text-white/80">{unopened}</span>
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => {
                  if (opening) return;
                  setOpen(false);
                  setLastOpened(null);
                  setRevealStep(0);
                  setErr(null);
                }}
              >
                Close
              </button>
            </div>

            {err ? <div className="mt-3 text-xs text-rose-200">{err}</div> : null}

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/80">Open</div>
                <p className="mt-2 text-[11px] leading-5 text-white/60">
                  Every 3 hands played awards a box. Boxes contain 3 powerups weighted by rarity.
                </p>
                <div className="mt-3 text-[11px] text-white/60">
                  Trade points: <span className="font-mono text-white/85">{tradePoints}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-3 py-2 text-[11px] text-white/85 hover:bg-white/10 disabled:opacity-40"
                    onClick={() => tradeBox("rare")}
                    disabled={tradePoints < 20 || opening}
                    title="Spend 20 trade points for a Rare box (2 guaranteed rare+)"
                  >
                    Trade 20 → Rare box
                  </button>
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-3 py-2 text-[11px] text-white/85 hover:bg-white/10 disabled:opacity-40"
                    onClick={() => tradeBox("mythic")}
                    disabled={tradePoints < 50 || opening}
                    title="Spend 50 trade points for a Mythic box (1 mythic)"
                  >
                    Trade 50 → Mythic box
                  </button>
                </div>
                <button
                  type="button"
                  disabled={unopened <= 0 || opening}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-40"
                  onClick={openNextBox}
                >
                  {opening ? "Opening…" : unopened > 0 ? "Open next box" : "No boxes"}
                </button>
                <div className="mt-3 text-[11px] text-white/50">
                  Tip: Rare/legendary items reveal slower and glow.
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/80">Reveal</div>

                <div
                  className={`mt-4 flex items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-6 ${
                    opening ? "animate-[mb-shake_.55s_ease-in-out_infinite]" : ""
                  }`}
                >
                  <div className="text-center">
                    <div className="text-sm font-semibold text-white/90">Mystery Box</div>
                    <div className="mt-2 text-[11px] text-white/60">
                      {opening ? "Unlocking…" : lastOpened ? "Opened" : "Open a box to reveal rewards"}
                    </div>
                  </div>
                </div>

                {lastOpened ? (
                  <>
                    {hasMythic ? (
                      <div className="mt-4 animate-[mb-fanfare_.35s_ease-out] rounded-3xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 shadow-[0_0_44px_rgba(34,211,238,.18)]">
                        MYTHIC DROP
                      </div>
                    ) : hasLegendary ? (
                      <div className="mt-4 animate-[mb-fanfare_.35s_ease-out] rounded-3xl border border-yellow-300/25 bg-yellow-300/10 px-4 py-3 text-center text-sm font-semibold text-yellow-100 shadow-[0_0_40px_rgba(250,204,21,.20)]">
                        LEGENDARY DROP
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {lastOpened.contents.map((id, i) => {
                        const r = lastOpened.rarity[i] ?? "common";
                        const show = revealStep >= i + 1;
                        const slow =
                          r === "legendary" ? "transition-opacity duration-[1200ms]" : r === "rare" ? "transition-opacity duration-[700ms]" : "transition-opacity duration-[250ms]";
                        return (
                          <div
                            key={`${id}-${i}`}
                            className={`rounded-3xl border border-white/10 bg-white/5 p-4 ${rarityClass(r)} ${
                              show ? "opacity-100 animate-[mb-pop_.2s_ease-out]" : `opacity-0 ${slow}`
                            }`}
                            style={{ opacity: show ? 1 : 0 }}
                          >
                            <div className="text-[11px] font-semibold text-white/70">{rarityLabel(r)}</div>
                            <div className="mt-2 font-mono text-sm font-semibold text-white">{id}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
