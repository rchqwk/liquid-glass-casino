"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/authClient";

type TablesResp = { tables?: any[]; dbSource?: string };
type TableResp = { state?: any; dbSource?: string; knownTables?: string[]; error?: string };

export function AdminMultiplayerOverlay() {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = user?.role_level ?? 0;

  const isMaster = role >= 3;
  const isMultiplayer = pathname?.startsWith("/casino/blackjack");

  const tableId = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.split("/").filter(Boolean);
    // /casino/blackjack/<id>
    if (parts.length >= 3 && parts[0] === "casino" && parts[1] === "blackjack" && parts[2] !== "games") {
      return parts[2] ?? null;
    }
    return null;
  }, [pathname]);

  const [hidden, setHidden] = useState(false);
  const [tablesDiag, setTablesDiag] = useState<TablesResp | null>(null);
  const [tableDiag, setTableDiag] = useState<TableResp | null>(null);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem("lgc.adminOverlay.hide") === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  useEffect(() => {
    if (!isMaster || !isMultiplayer) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/blackjack/tables", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as TablesResp;
        if (cancelled) return;
        setTablesDiag(data);
      } catch {
        if (!cancelled) setTablesDiag({ dbSource: "fetch_error", tables: [] });
      }
    };
    const id = window.setInterval(tick, 1500);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isMaster, isMultiplayer]);

  useEffect(() => {
    if (!isMaster || !isMultiplayer || !tableId || tableId === "undefined") {
      setTableDiag(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/blackjack/tables/${tableId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as TableResp;
        if (cancelled) return;
        setTableDiag({ ...data, error: res.ok ? undefined : (data as any)?.error ?? "Error" });
      } catch {
        if (!cancelled) setTableDiag({ error: "fetch_error" });
      }
    };
    const id = window.setInterval(tick, 1200);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isMaster, isMultiplayer, tableId]);

  if (!isMaster || !isMultiplayer || hidden) return null;

  const tablesCount = tablesDiag?.tables?.length ?? 0;
  const db = tableDiag?.dbSource ?? tablesDiag?.dbSource ?? "?";
  const tableIds = (tablesDiag?.tables ?? []).map((t: any) => String(t?.id ?? "")).filter(Boolean);
  const currentKnown = tableId ? tableIds.includes(tableId) : null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[70] w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-white/90">Master Debug (Multiplayer)</div>
          <button
            type="button"
            className="rounded-2xl px-2 py-1 text-[11px] text-white/60 hover:text-white"
            onClick={() => {
              try {
                localStorage.setItem("lgc.adminOverlay.hide", "1");
              } catch {
                // ignore
              }
              setHidden(true);
            }}
          >
            Hide
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/70">
          dbSource: <span className="font-mono text-white/90">{db}</span>
        </div>
        <div className="mt-1 text-[11px] text-white/70">
          public tables: <span className="font-mono text-white/90">{tablesCount}</span>
        </div>
        {tableId ? (
          <div className="mt-1 text-[11px] text-white/70">
            tableId: <span className="font-mono text-white/90">{tableId}</span>
          </div>
        ) : null}
        {tableId ? (
          <div className="mt-1 text-[11px] text-white/70">
            in public list:{" "}
            <span className={`font-mono ${currentKnown ? "text-emerald-200" : "text-rose-200"}`}>
              {currentKnown ? "yes" : "no"}
            </span>
          </div>
        ) : null}

        {tableIds.length ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] font-semibold text-white/80">Public table IDs</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {tableIds.slice(0, 6).map((id) => (
                <Link
                  key={id}
                  href={`/casino/blackjack/${id}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-white/80 hover:bg-white/10"
                >
                  {id}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {tableDiag?.error ? (
          <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
            table error: <span className="font-mono">{tableDiag.error}</span>
            {Array.isArray(tableDiag.knownTables) && tableDiag.knownTables.length ? (
              <div className="mt-1 text-rose-100/80">
                knownTables: <span className="font-mono">{tableDiag.knownTables.join(", ")}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/casino/admin" className="glass-soft rounded-2xl px-3 py-2 text-[11px] text-white/80 hover:bg-white/10">
            Admin
          </Link>
          <button
            type="button"
            className="glass-soft rounded-2xl px-3 py-2 text-[11px] text-white/80 hover:bg-white/10"
            onClick={() => {
              try {
                localStorage.removeItem("lgc.adminOverlay.hide");
              } catch {
                // ignore
              }
              setHidden(false);
            }}
            title="Re-enable after reload"
          >
            Unhide next load
          </button>
        </div>
      </div>
    </div>
  );
}
