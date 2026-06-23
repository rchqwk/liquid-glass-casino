"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authClient";
import { useSkin } from "../../lib/skin";
import { useUiLayout } from "../../lib/uiLayout";
import { useUiScale } from "../../lib/uiScale";

type ApiResp =
  | { ok: true; user?: any; prestige_level?: number; prestige_points?: number; name_color?: string | null }
  | { error: string };

export default function CustomizationsPage() {
  const { user, loading, refresh } = useAuth();
  const { skin, setSkin } = useSkin();
  const { layout, setLayout } = useUiLayout();
  const { uiScale, setUiScale } = useUiScale();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nameColor, setNameColor] = useState<string | null>(null);

  const prestige = Number((user as any)?.prestige_level ?? 0);
  const COLORS: Array<{ key: string; label: string; minPrestige: number }> = [
    { key: "brown", label: "Brown", minPrestige: 1 },
    { key: "red", label: "Red", minPrestige: 2 },
    { key: "orange", label: "Orange", minPrestige: 3 },
    { key: "yellow", label: "Yellow", minPrestige: 4 },
    { key: "green", label: "Green", minPrestige: 5 },
    { key: "teal", label: "Teal", minPrestige: 6 },
    { key: "blue", label: "Blue", minPrestige: 7 },
    { key: "indigo", label: "Indigo", minPrestige: 8 },
    { key: "violet", label: "Violet", minPrestige: 9 },
    { key: "pink", label: "Pink", minPrestige: 10 },
    { key: "cyan", label: "Cyan", minPrestige: 15 },
    { key: "lime", label: "Lime", minPrestige: 20 },
  ];

  useEffect(() => {
    setNameColor(((user as any)?.name_color ?? null) as any);
  }, [user?.id, (user as any)?.name_color]);

  const saveColor = async (next: string | null) => {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/customizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name_color: next ?? "default" }),
      });
      const j = (await res.json().catch(() => ({}))) as ApiResp;
      if (!res.ok || "error" in j) throw new Error("error" in j ? j.error : "Failed");
      setNameColor(next);
      await refresh();
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(String(e?.message ?? "Failed"));
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(() => {
    if (loading) return "Customizations";
    if (!user) return "Sign in required";
    return `Customizations @${user.username}`;
  }, [loading, user]);

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="mt-1 text-xs text-white/60">
            Prestige: <span className="font-mono text-white/80">{prestige}</span>
          </div>
        </div>
        <Link
          href="/casino"
          className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
        >
          Back
        </Link>
      </div>

      {!user && !loading ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          Please sign in to edit customizations.
        </div>
      ) : null}

      {user ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">UI skin</div>
            <div className="mt-1 text-xs text-white/60">
              Pick a visual style that fits Discord Activities. This is a local preference on this device.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  skin === "glass"
                    ? "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => setSkin("glass")}
              >
                Liquid Glass
              </button>
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  skin === "cartoon"
                    ? "border-yellow-300/30 bg-yellow-500/10 text-yellow-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => setSkin("cartoon")}
              >
                Cartoon
              </button>
            </div>

            <div className="mt-3 text-xs text-white/55">
              Tip: the cartoon skin uses thicker “sticker” shadows and brighter gradients while keeping the same layout.
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">UI layout</div>
            <div className="mt-1 text-xs text-white/60">
              Horizontal mode is optimized for Discord Activities: the felt stays full-screen and panels float in only when needed.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  layout === "standard"
                    ? "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => setLayout("standard")}
              >
                Standard
              </button>
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  layout === "horizontal"
                    ? "border-yellow-300/30 bg-yellow-500/10 text-yellow-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => setLayout("horizontal")}
              >
                Horizontal
              </button>
            </div>

            <div className="mt-3 text-xs text-white/55">
              In horizontal mode, controls collapse to side buttons and open as centered panels. Betting stake stays visible while you’re seated and
              haven’t locked a stake yet.
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">UI scale</div>
            <div className="mt-1 text-xs text-white/60">
              Scales the floating horizontal HUD and menus. Default is <span className="font-mono text-white/80">150%</span> because it reads better
              in Discord Activities.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[100, 125, 150, 175].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    uiScale === scale
                      ? "border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                  }`}
                  onClick={() => setUiScale(scale as 100 | 125 | 150 | 175)}
                >
                  {scale}%
                </button>
              ))}
            </div>

            <div className="mt-3 text-xs text-white/55">This is a local preference on this device and mainly affects the horizontal blackjack HUD.</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Name color</div>
            <div className="mt-1 text-xs text-white/60">Controls how your name appears at the Blackjack table.</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  !nameColor
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => void saveColor(null)}
              >
                Default
              </button>
              {COLORS.map((c) => {
                const unlocked = prestige >= c.minPrestige;
                const selected = nameColor === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={saving || !unlocked}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      selected
                        ? "border-yellow-300/30 bg-yellow-500/10 text-yellow-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:text-white disabled:opacity-40"
                    }`}
                    onClick={() => void saveColor(c.key)}
                    title={unlocked ? `Unlocked at Prestige ${c.minPrestige}` : `Unlock at Prestige ${c.minPrestige}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {msg ? <div className="mt-3 text-xs text-white/60">{msg}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
