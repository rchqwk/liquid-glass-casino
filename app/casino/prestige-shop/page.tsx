"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../lib/authClient";

export default function PrestigeShopPage() {
  const { user, loading, refresh } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const points = Number((user as any)?.prestige_points ?? 0);

  const buyBond = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/prestige-shop/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: "bond" }),
      });
      const j = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      await refresh();
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
                onClick={buyBond}
              >
                Buy Bond
              </button>
            </div>
            {msg ? <div className="mt-3 text-xs text-white/60">{msg}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

