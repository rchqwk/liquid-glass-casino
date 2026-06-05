"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authClient";

type TableRow = {
  id: string;
  name: string;
  phase: string;
  round: number;
  seatsFilled: number;
  spectators: number;
  bettingEndsAt: number;
};

export default function BlackjackLobbyPage() {
  const { user, loading: authLoading, discordMode } = useAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [name, setName] = useState("Blackjack Table");
  const [isPublic, setIsPublic] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [autoJoining, setAutoJoining] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/blackjack/tables", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { tables?: TableRow[] };
        if (cancelled) return;
        setTables(data.tables ?? []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Discord mode: tables are per voice call and non-public, so the lobby will appear empty.
  // If we're in Discord and no public tables exist, auto-create/join the call table.
  useEffect(() => {
    if (authLoading) return;
    if (!discordMode) return;
    if (!user) return;
    if (autoJoining) return;

    // Determine channel_id from current URL or stored sessionStorage query string.
    let channelId: string | null = null;
    try {
      const sp = new URLSearchParams(window.location.search || "");
      channelId = sp.get("channel_id");
      if (!channelId) {
        const qs = sessionStorage.getItem("lgc.discord.qs") ?? "";
        const sp2 = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
        channelId = sp2.get("channel_id");
      }
    } catch {
      // ignore
    }
    if (!channelId) return;

    setAutoJoining(true);
    (async () => {
      try {
        await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/ensure`, { method: "POST" });
        await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: false }),
        });
        window.location.href = `/casino/blackjack/${encodeURIComponent(channelId)}`;
      } finally {
        // if redirect fails, allow manual retry
        setAutoJoining(false);
      }
    })();
  }, [authLoading, discordMode, user, autoJoining]);

  const now = Date.now();
  const sorted = useMemo(() => [...tables].sort((a, b) => (b.bettingEndsAt ?? 0) - (a.bettingEndsAt ?? 0)), [tables]);

  return (
    <div className="flex flex-col gap-6">
      {autoJoining ? (
        <div className="glass glass-shine rounded-3xl p-6 text-white/80">
          <div className="text-sm font-semibold text-white">Joining your Discord call table…</div>
          <div className="mt-2 text-xs text-white/60">Creating the table if needed, then redirecting.</div>
        </div>
      ) : null}
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Blackjack (Multiplayer)</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Tables support up to 10 seated players plus spectators. Each round has a 30s betting timer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="glass-soft glass-shine rounded-3xl p-5" data-tour="bj-create-join">
          <p className="text-sm font-medium text-white">Create table</p>
          <label className="mt-4 block text-xs text-white/60">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public table (visible in lobby)
          </label>
          <button
            type="button"
            disabled={loading}
            className="mt-4 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
            onClick={async () => {
              setErr(null);
              setLoading(true);
              try {
                const res = await fetch("/api/blackjack/tables", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name, public: isPublic }),
                });
                const data = (await res.json()) as any;
                if (!res.ok) throw new Error(data?.error ?? "Failed");
                window.location.href = `/casino/blackjack/${data.tableId}`;
              } catch (e: any) {
                setErr(String(e?.message ?? "Failed"));
              } finally {
                setLoading(false);
              }
            }}
          >
            Create & Join
          </button>
          {err ? <div className="mt-3 text-xs text-rose-200">{err}</div> : null}
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5" data-tour="bj-public-tables">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Public tables</p>
            <span className="text-xs text-white/60">{sorted.length} found</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {sorted.map((t) => {
              const secs = Math.max(0, Math.ceil(((t.bettingEndsAt ?? 0) - now) / 1000));
              return (
                <Link
                  key={t.id}
                  href={`/casino/blackjack/${t.id}`}
                  className="glass-soft rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="mt-1 text-xs text-white/60">
                        Seats: <span className="font-mono">{t.seatsFilled}/10</span> • Spectators:{" "}
                        <span className="font-mono">{t.spectators}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/60">
                      <div className="font-mono text-white/80">{t.phase}</div>
                      <div className="mt-1">
                        Betting: <span className="font-mono">{secs}s</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {sorted.length === 0 ? <div className="text-sm text-white/60">No public tables yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
