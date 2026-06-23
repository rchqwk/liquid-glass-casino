"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authClient";
import { getBlackjackTableIdFromPayload } from "./useBlackjackTableContract";

type TableRow = {
  id: string;
  name: string;
  phase: string;
  round: number;
  seatsFilled: number;
  spectators: number;
  bettingEndsAt: number;
};

export function BlackjackLobbyClient({ variant = "v2" }: { variant?: "v2" | "classic" }) {
  const { user, loading: authLoading, discordMode } = useAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [name, setName] = useState("Blackjack Table");
  const [isPublic, setIsPublic] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [autoJoining, setAutoJoining] = useState(false);
  const tableBasePath = variant === "v2" ? "/casino/blackjack-v2" : "/casino/blackjack";

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let retryCount = 0;

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = (ok: boolean) => {
      if (cancelled) return;
      const visible = typeof document === "undefined" ? true : document.visibilityState === "visible";
      const base = visible ? 5000 : 15000;
      const wait = ok ? base : Math.min(30000, base * 2 ** Math.min(retryCount, 3));
      clearTimer();
      timer = window.setTimeout(() => {
        void run();
      }, wait);
    };

    const run = async () => {
      try {
        const res = await fetch("/api/blackjack/tables", { cache: "no-store" });
        if (!res.ok) {
          retryCount += 1;
          scheduleNext(false);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { tables?: TableRow[] };
        if (cancelled) return;
        setTables(data.tables ?? []);
        retryCount = 0;
        scheduleNext(true);
      } catch {
        if (cancelled) return;
        retryCount += 1;
        // Keep existing lobby state on transient failures.
        scheduleNext(false);
      }
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        retryCount = 0;
        clearTimer();
        void run();
      }
    };

    void run();
    try {
      document.addEventListener("visibilitychange", onVisibilityChange);
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      clearTimer();
      try {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!discordMode) return;
    if (!user) return;
    if (autoJoining) return;

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
        window.location.href = `${tableBasePath}/${encodeURIComponent(channelId)}`;
      } finally {
        setAutoJoining(false);
      }
    })();
  }, [authLoading, discordMode, user, autoJoining, tableBasePath]);

  const now = Date.now();
  const sorted = useMemo(() => [...tables].sort((a, b) => (b.bettingEndsAt ?? 0) - (a.bettingEndsAt ?? 0)), [tables]);
  const livePlayers = useMemo(
    () => sorted.reduce((sum, t) => sum + Math.max(0, Number(t.seatsFilled ?? 0)) + Math.max(0, Number(t.spectators ?? 0)), 0),
    [sorted],
  );

  if (variant === "classic") {
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
          <CreateTablePanel
            name={name}
            setName={setName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            err={err}
            setErr={setErr}
            loading={loading}
            setLoading={setLoading}
            tableBasePath={tableBasePath}
            variant={variant}
          />
          <PublicTablesPanel sorted={sorted} now={now} tableBasePath={tableBasePath} variant={variant} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {autoJoining ? (
        <div className="glass glass-shine rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-white/85">
          <div className="text-sm font-semibold text-white">Joining your Discord call table…</div>
          <div className="mt-2 text-xs leading-5 text-white/70">
            Creating the room if needed and dropping you straight into the table.
          </div>
        </div>
      ) : null}

      <section className="glass glass-shine rounded-[28px] border border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-cyan-100">
                BLACKJACK LIVE
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Blackjack is the main floor now.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70 sm:text-[15px]">
                Jump into live tables built for Discord Activity, desktop, and mobile. Open a seat, watch a live room, or create a table
                with the streamlined V2 flow that now powers the main casino home.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[320px]">
              <MetricCard label="Live tables" value={String(sorted.length)} />
              <MetricCard label="Players live" value={String(livePlayers)} />
              <MetricCard label="Seat limit" value="10" />
              <MetricCard label="Status" value="Live" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <QuickLink href="/casino/tutorial" title="Tutorial" desc="Walk through betting, powerups, and table flow." />
            <QuickLink href="/casino/profile" title="Profile" desc="Account, sign-in, and identity." />
            <QuickLink href="/casino/customizations" title="Customizations" desc="Cards, name color, and cosmetics." />
            <QuickLink href="/casino/prestige-shop" title="Prestige Shop" desc="Progression, bonds, and prestige buys." />
            <QuickLink href="/casino/legacy" title="Legacy Casino" desc="Slots, roulette, dice, poker, and side modes." />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <PublicTablesPanel sorted={sorted} now={now} tableBasePath={tableBasePath} variant={variant} />
        <CreateTablePanel
          name={name}
          setName={setName}
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          err={err}
          setErr={setErr}
          loading={loading}
          setLoading={setLoading}
          tableBasePath={tableBasePath}
          variant={variant}
          compact
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="glass-soft rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-xs leading-5 text-white/65">{desc}</div>
    </Link>
  );
}

function CreateTablePanel(props: {
  name: string;
  setName: (v: string) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  err: string | null;
  setErr: (v: string | null) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  tableBasePath: string;
  variant?: "v2" | "classic";
  compact?: boolean;
}) {
  const { name, setName, isPublic, setIsPublic, err, setErr, loading, setLoading, tableBasePath, variant = "classic", compact } = props;
  const isV2 = variant === "v2";
  return (
    <div className="glass-soft glass-shine rounded-3xl p-5" data-tour="bj-create-join">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">
          {compact ? (isV2 ? "Open a live table" : "Create a new room") : isV2 ? "Create live table" : "Create table"}
        </p>
        {compact ? <span className="text-[11px] text-white/50">{isV2 ? "Live-ready" : "Discord-friendly"}</span> : null}
      </div>
      <label className="mt-4 block text-xs text-white/60">{isV2 ? "Table name" : "Name"}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
      />
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {isV2 ? "Show in live lobby" : "Public table (visible in lobby)"}
      </label>
      <button
        type="button"
        disabled={loading}
        className="mt-4 glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
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
            const tableId = getBlackjackTableIdFromPayload(data);
            if (!tableId) throw new Error("Table created but id missing");
            window.location.href = `${tableBasePath}/${tableId}`;
          } catch (e: any) {
            setErr(String(e?.message ?? "Failed"));
          } finally {
            setLoading(false);
          }
        }}
      >
        {isV2 ? "Create live table" : "Create & Join"}
      </button>
      {err ? <div className="mt-3 text-xs text-rose-200">{err}</div> : null}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-white/60">
        {isV2
          ? "Live tables stay synced across Discord Activity and browser clients, with the V2 shell as the primary blackjack home."
          : "This table uses the shared live multiplayer flow."}
      </div>
    </div>
  );
}

function PublicTablesPanel({
  sorted,
  now,
  tableBasePath,
  variant = "classic",
}: {
  sorted: TableRow[];
  now: number;
  tableBasePath: string;
  variant?: "v2" | "classic";
}) {
  const isV2 = variant === "v2";
  return (
    <div className="glass-soft glass-shine rounded-3xl p-5" data-tour="bj-public-tables">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{isV2 ? "Live tables" : "Public tables"}</p>
          <p className="mt-1 text-xs text-white/55">
            {isV2 ? "Open a live seat or watch the table first." : "Jump straight into a live room or spectate first."}
          </p>
        </div>
        <span className="text-xs text-white/60">{sorted.length} found</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {sorted.map((t) => {
          const secs = Math.max(0, Math.ceil(((t.bettingEndsAt ?? 0) - now) / 1000));
          return (
            <Link
              key={t.id}
              href={`${tableBasePath}/${t.id}`}
              className="glass-soft rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="mt-1 text-xs leading-5 text-white/60">
                    {isV2 ? "Seats filled" : "Seats"}: <span className="font-mono">{t.seatsFilled}/10</span> • {isV2 ? "Watching live" : "Spectators"}:{" "}
                    <span className="font-mono">{t.spectators}</span>
                  </div>
                  <div className="mt-2 inline-flex rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] text-white/65">
                    Round {Math.max(1, Number(t.round ?? 0))}
                  </div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div className="font-mono text-white/80">{t.phase}</div>
                  <div className="mt-1">
                    {isV2 ? "Betting window" : "Betting"}: <span className="font-mono">{secs}s</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/60">
            {isV2 ? "No live tables yet. Open the first live table." : "No public tables yet. Create one and make it the first room in the lobby."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
