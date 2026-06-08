"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authClient";
import { useWallet } from "../../lib/wallet";
import { formatChips, formatNumberWords } from "../../lib/format";

const COLOR_UNLOCKS: Array<{ key: string; label: string; minPrestige: number }> = [
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

function nextPrestigeThreshold(level: number) {
  const base = 1_000_000_000;
  const step = 1_000_000;
  return base * Math.pow(step, Math.max(0, level));
}

export default function PrestigeShopPage() {
  const { user, loading, refresh } = useAuth();
  const { balance } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bonusPoints, setBonusPoints] = useState<number>(0);

  const prestigeLevel = Number((user as any)?.prestige_level ?? 0);
  const points = Number((user as any)?.prestige_points ?? 0);
  const nextPrestigeLevel = prestigeLevel + 1;
  const nextPrestigeAt = useMemo(() => nextPrestigeThreshold(prestigeLevel), [prestigeLevel]);
  const chipsNeeded = useMemo(() => Math.max(0, nextPrestigeAt - Number(balance ?? 0)), [nextPrestigeAt, balance]);
  const currentRefill = useMemo(() => Math.max(0, 5000 + 10000 * prestigeLevel), [prestigeLevel]);
  const nextRefill = useMemo(() => Math.max(0, 5000 + 10000 * nextPrestigeLevel), [nextPrestigeLevel]);
  const currentPrestigeBonus = Math.max(0, 2 * prestigeLevel);
  const nextPrestigeBonus = Math.max(0, 2 * nextPrestigeLevel);
  const unlockedColors = useMemo(
    () => COLOR_UNLOCKS.filter((c) => prestigeLevel >= c.minPrestige).map((c) => c.label),
    [prestigeLevel],
  );
  const nextLevelColors = useMemo(
    () => COLOR_UNLOCKS.filter((c) => c.minPrestige === nextPrestigeLevel).map((c) => c.label),
    [nextPrestigeLevel],
  );

  const loadBp = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/blackjack/boxes", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json().catch(() => ({}))) as any;
      setBonusPoints(Math.max(0, Math.floor(Number(j?.bonusPoints ?? 0) || 0)));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setBonusPoints(0);
    void loadBp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const buyBond = async (currency: "pp" | "bp") => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/prestige-shop/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: "bond", currency }),
      });
      const j = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      await refresh();
      await loadBp();
      setMsg("Bought Bond.");
    } catch (e: any) {
      setMsg(String(e?.message ?? "Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Prestige Shop</h1>
          <div className="mt-1 text-xs text-white/60">
            Prestige Points: <span className="font-mono text-white/80">{points}</span>
            <span className="mx-2 text-white/35">•</span>
            Bonus Points: <span className="font-mono text-white/80">{bonusPoints}</span>
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
          Please sign in to use the prestige shop.
        </div>
      ) : null}

      {user ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Prestige Progress</div>
                <div className="mt-1 text-xs text-white/60">
                  Current prestige: <span className="font-mono text-white/80">★{prestigeLevel}</span>
                </div>
              </div>
              <div className="text-right text-xs text-white/60">
                <div>
                  Next prestige at: <span className="font-mono text-white/80">{formatNumberWords(nextPrestigeAt)}</span>
                </div>
                <div className="mt-1">
                  {chipsNeeded <= 0 ? (
                    <span className="text-emerald-200">Ready to prestige now</span>
                  ) : (
                    <>
                      Need: <span className="font-mono text-white/80">{formatNumberWords(chipsNeeded)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/60">
              Current balance: <span className="font-mono text-white/80">{formatChips(Number(balance ?? 0))}</span> ⓒ
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Current Prestige Advantages</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-white/70">
                <li>
                  Name badge: <span className="font-mono text-white/85">★{prestigeLevel}</span>
                </li>
                <li>
                  Prestige Points owned: <span className="font-mono text-white/85">{points}</span>
                </li>
                <li>
                  15-minute refill amount: <span className="font-mono text-white/85">+{formatChips(currentRefill)}</span> ⓒ
                </li>
                <li>
                  Blackjack prestige bonus: <span className="font-mono text-white/85">+{currentPrestigeBonus}x</span> on Blackjack payouts
                </li>
                <li>
                  5+ card win prestige bonus: <span className="font-mono text-white/85">+{currentPrestigeBonus}x</span>
                </li>
                <li>
                  Unlocked name colors:{" "}
                  <span className="text-white/85">
                    {unlockedColors.length > 0 ? unlockedColors.join(", ") : "None yet"}
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-yellow-300/15 bg-yellow-500/10 p-5">
              <div className="text-sm font-semibold text-yellow-100">Available At Next Prestige</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-yellow-100/80">
                <li>
                  New badge: <span className="font-mono text-yellow-100">★{nextPrestigeLevel}</span>
                </li>
                <li>
                  +1 Prestige Point: you will have <span className="font-mono text-yellow-100">{points + 1}</span>
                </li>
                <li>
                  15-minute refill becomes <span className="font-mono text-yellow-100">+{formatChips(nextRefill)}</span> ⓒ
                </li>
                <li>
                  Blackjack prestige bonus becomes <span className="font-mono text-yellow-100">+{nextPrestigeBonus}x</span>
                </li>
                <li>
                  5+ card win prestige bonus becomes <span className="font-mono text-yellow-100">+{nextPrestigeBonus}x</span>
                </li>
                <li>
                  New color unlocks:{" "}
                  <span className="text-yellow-100">
                    {nextLevelColors.length > 0 ? nextLevelColors.join(", ") : "No new color at this level"}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Bonds</div>
                <div className="mt-1 text-xs text-white/60">
                  Holdable item. When activated in a Blackjack table, it compounds by 1.2× every 60s while seated.
                </div>
              </div>
              <div className="text-xs text-white/60">
                Cost: <span className="font-mono text-white/80">1</span> point
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy || points < 1}
                className="glass-soft rounded-2xl border border-yellow-300/20 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-40"
                onClick={() => buyBond("pp")}
              >
                Buy Bond (1 PP)
              </button>
              <button
                type="button"
                disabled={busy || bonusPoints < 50}
                className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
                onClick={() => buyBond("bp")}
                title="Costs 50 bonus points"
              >
                Buy Bond (50 BP)
              </button>
            </div>
            {msg ? <div className="mt-3 text-xs text-white/60">{msg}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
