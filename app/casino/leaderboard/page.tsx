"use client";

import { useEffect, useState } from "react";
import { formatChips } from "../../lib/format";

type Row = {
  username: string;
  profit_total: number;
  wager_total: number;
  bets: number;
  updated_at: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const data = (await res.json()) as { rows: Row[] };
        setRows(data.rows ?? []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Leaderboard</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Ranked by total profit (play-money). Sign in with a username to appear
          here.
        </p>
      </div>

      <div className="glass-soft glass-shine rounded-3xl p-5">
        {loading ? (
          <p className="text-sm text-white/70">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/70">No players yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="text-xs text-white/55">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Profit</th>
                  <th className="py-2 pr-4">Wagered</th>
                  <th className="py-2 pr-4">Bets</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-white/55">{i + 1}</td>
                    <td className="py-2 pr-4 font-semibold text-white">
                      @{r.username}
                    </td>
                    <td
                      className={`py-2 pr-4 font-mono ${
                        r.profit_total >= 0 ? "text-emerald-200" : "text-rose-200"
                      }`}
                    >
                      {r.profit_total >= 0 ? "+" : ""}
                      {formatChips(Number(r.profit_total))}
                    </td>
                    <td className="py-2 pr-4 font-mono text-white/70">
                      {formatChips(Number(r.wager_total))}
                    </td>
                    <td className="py-2 pr-4 font-mono text-white/70">
                      {r.bets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
