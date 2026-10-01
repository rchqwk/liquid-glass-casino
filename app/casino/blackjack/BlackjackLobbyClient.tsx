"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../lib/authClient";
import { getBlackjackTableIdFromPayload } from "./useBlackjackTableContract";

type TableRow = { id: string; name: string; phase: string; round: number; seatsFilled: number; spectators: number; bettingEndsAt: number };
type LobbyStatus = "loading" | "ready" | "stale" | "error";
const phaseLabels: Record<string, string> = { betting: "Taking bets", player_turns: "Players' turns", dealer: "Dealer's turn", dealer_window: "Dealer response", settling: "Settling round" };

export function BlackjackLobbyClient({ variant = "v2" }: { variant?: "v2" | "classic" }) {
  const router = useRouter();
  const { user, loading: authLoading, discordMode } = useAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [name, setName] = useState("Blackjack Table");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "join" | "discord" | null>(null);
  const [status, setStatus] = useState<LobbyStatus>("loading");
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(0);
  const busy = useRef(false);
  const discordAttempt = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const tableBasePath = variant === "v2" ? "/casino/blackjack-v2" : "/casino/blackjack";

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;
    let loaded = false;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch("/api/blackjack/tables", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.tables)) throw new Error("Lobby unavailable");
        if (cancelled) return;
        setTables(data.tables);
        setStatus("ready");
        loaded = true;
        failures = 0;
      } catch {
        if (cancelled) return;
        setStatus(loaded ? "stale" : "error");
        failures += 1;
      } finally { running = false; }
      if (!cancelled) timer = window.setTimeout(run, Math.min(30000, (document.hidden ? 15000 : 5000) * 2 ** Math.min(failures, 3)));
    };
    const resume = () => {
      if (!document.hidden) { window.clearTimeout(timer); void run(); }
    };
    void run();
    document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [refreshKey]);

  // Preserve channel pairing and verify acknowledgement before redirecting.
  useEffect(() => {
    if (authLoading || !discordMode || !user) return;
    let channel = new URLSearchParams(window.location.search).get("channel_id");
    try { channel ||= new URLSearchParams(sessionStorage.getItem("lgc.discord.qs") || "").get("channel_id"); } catch { /* optional storage */ }
    if (!channel || discordAttempt.current === channel) return;
    discordAttempt.current = channel;
    setPending("discord");
    void (async () => {
      try { await joinTable(channel); }
      catch (error) { setErr(error instanceof Error ? error.message : "Could not join your Discord table."); }
      finally { setPending(null); }
    })();
    // Channel joining happens once per entry, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, discordMode, user?.id, tableBasePath]);

  async function joinTable(id: string) {
    const encoded = encodeURIComponent(id);
    const ensured = await fetch(`/api/blackjack/tables/${encoded}/ensure`, { method: "POST" });
    if (!ensured.ok) {
      const result = await ensured.json().catch(() => ({}));
      throw new Error(result.error || "Could not open the table.");
    }
    const response = await fetch(`/api/blackjack/tables/${encoded}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spectate: false }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not join the table.");
    router.push(`${tableBasePath}/${encoded}`);
  }

  function requireAccount() {
    if (user) return true;
    window.dispatchEvent(new CustomEvent("lgc:signIn"));
    return false;
  }

  async function createTable() {
    if (busy.current || !requireAccount()) return;
    busy.current = true; setPending("create"); setErr(null);
    try {
      const response = await fetch("/api/blackjack/tables", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() || "Blackjack Table", public: isPublic }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create the table.");
      const id = getBlackjackTableIdFromPayload(result);
      if (!id) throw new Error("The table response was incomplete. Refresh the lobby before trying again.");
      router.push(`${tableBasePath}/${encodeURIComponent(id)}`);
    } catch (error) { setErr(error instanceof Error ? error.message : "Could not create the table."); }
    finally { busy.current = false; setPending(null); }
  }

  async function joinByCode() {
    if (busy.current || !requireAccount()) return;
    const code = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) { setErr("Enter the join code shared by your friend."); return; }
    busy.current = true; setPending("join"); setErr(null);
    try {
      const response = await fetch(`/api/blackjack/tables/resolve?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.tableId) throw new Error(result.error || "That join code was not found.");
      await joinTable(String(result.tableId));
    } catch (error) { setErr(error instanceof Error ? error.message : "Could not join by code."); }
    finally { busy.current = false; setPending(null); }
  }

  const sorted = useMemo(() => [...tables].sort((a, b) => b.seatsFilled - a.seatsFilled || b.bettingEndsAt - a.bettingEndsAt), [tables]);
  const players = sorted.reduce((sum, table) => sum + table.seatsFilled, 0);
  const focusCreate = () => { nameInput.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); nameInput.current?.focus({ preventScroll: true }); };

  return (
    <div>
      <div className="casino-lobby-heading">
        <div><div className="casino-eyebrow">The social table</div><h1 className="casino-heading mt-2">A seat for you. A table for everyone.</h1><p>Live Blackjack with friends, in your browser or Discord.</p></div>
        <button className="casino-button casino-primary shrink-0" type="button" onClick={focusCreate}>Create a table <span aria-hidden="true">↗</span></button>
      </div>
      {pending === "discord" ? <p className="casino-notice mb-5" role="status">Joining your Discord call table…</p> : null}
      {err ? <p className="casino-error mb-5" role="alert">{err}</p> : null}
      <div className="casino-lobby-layout">
        <section className="casino-panel" aria-labelledby="live-tables-heading" data-tour="bj-public-tables">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="live-tables-heading" className="text-lg font-semibold">Live tables</h2><p className="casino-muted mt-1 text-xs">Choose a room, then take a seat or watch.</p></div><span className="casino-tag">{status === "ready" ? `${sorted.length} tables · ${players} seated` : status === "loading" ? "Connecting…" : "Connection interrupted"}</span></div>
          {status === "error" || status === "stale" ? <div className="casino-notice mt-5" role="status"><p>{status === "stale" ? "These are the last known tables. Reconnecting…" : "The lobby could not load. Your connection may be interrupted."}</p><button className="casino-button casino-secondary mt-3" onClick={() => { setStatus("loading"); setRefreshKey(value => value + 1); }} type="button">Retry lobby</button></div> : null}
          <div className="casino-table-list" aria-busy={status === "loading"}>
            {status === "loading" ? <p className="casino-muted py-10 text-center" role="status">Finding live tables…</p> : sorted.map(table => (
              <Link key={table.id} href={`${tableBasePath}/${encodeURIComponent(table.id)}`} className="casino-table-row"><div><h3>{table.name}</h3><p>{table.seatsFilled}/10 seated · {table.spectators} watching · Round {Math.max(1, table.round)}</p></div><div className="flex flex-wrap items-center gap-3"><span className="casino-tag">{phaseLabels[table.phase] || "Round in progress"}{table.phase === "betting" && now > 0 ? ` · ${Math.max(0, Math.ceil((table.bettingEndsAt - now) / 1000))}s` : ""}</span><span className="text-sm font-semibold" aria-hidden="true">Open →</span></div></Link>
            ))}
            {status === "ready" && sorted.length === 0 ? <div className="casino-empty"><div className="casino-empty__mark" aria-hidden="true">♠</div><h3>The first table is yours.</h3><p>Start a room and invite your friends. Public tables appear here when they open.</p><button type="button" className="casino-button casino-primary" onClick={focusCreate}>Create the first table</button></div> : null}
          </div>
          <div className="casino-lobby-help"><Link href="/casino/tutorial">New here? Take the tutorial</Link><Link href="/casino/blackjack/rules">Rules &amp; payouts</Link><Link href="/casino/blackjack/special-rules">Power-up rules</Link></div>
        </section>
        <div className="casino-lobby-forms">
          <form className="casino-panel" onSubmit={event => { event.preventDefault(); void joinByCode(); }}>
            <h2 className="text-base font-semibold">Meet your friends</h2><p className="casino-muted mt-2 text-xs leading-5">Have a join code? Go straight to their room.</p>
            <label className="casino-field" htmlFor="casino-join-code">Join code<input id="casino-join-code" value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} placeholder="e.g. ABC123" autoCapitalize="characters" autoComplete="off" maxLength={32} /></label>
            <button type="submit" className="casino-button casino-secondary mt-4 w-full" disabled={!!pending || authLoading}>{pending === "join" ? "Joining…" : "Join with code"}</button>
          </form>
          <form className="casino-panel" data-tour="bj-create-join" onSubmit={event => { event.preventDefault(); void createTable(); }}>
            <h2 className="text-base font-semibold">Your table, your company.</h2>
            <label className="casino-field" htmlFor="casino-table-name">Table name<input id="casino-table-name" ref={nameInput} value={name} onChange={event => setName(event.target.value)} maxLength={48} /></label>
            <label className="casino-muted mt-4 flex items-center gap-3 text-xs"><input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} className="h-5 w-5 accent-emerald-300" />Show in the public lobby</label>
            <p className="casino-muted mt-3 text-xs leading-5">{isPublic ? "Anyone can discover your room. Up to 10 seated players." : "Hidden from the lobby. Share your invite with friends."}</p>
            <button type="submit" className="casino-button casino-primary mt-4 w-full" disabled={!!pending || authLoading}>{pending === "create" ? "Creating…" : "Create & join"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
