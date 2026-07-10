"use client";

import { type ReactNode } from "react";
import { type BoxTier } from "../inventory/box-opening";

export interface PowerupLedgerEntry {
  timestamp: number;
  powerupId: string;
  delta: number;
  source: "box_open" | "achievement" | "trade_up" | "consumed" | "admin_grant" | "prestige_reward";
  tableId?: string;
  metadata?: Record<string, unknown>;
}

export interface BoxDropRecord {
  timestamp: number;
  tier: BoxTier;
  source: "hand_played" | "achievement" | "admin_grant" | "referral";
  state: "unopened" | "opened";
  contents?: Array<{ powerupId: string; rarity: string }>;
}

export interface UserInventorySnapshot {
  userId: string;
  username: string;
  powerups: Record<string, number>;
  boxes: Record<BoxTier, number>;
  collectibles: Record<string, number>;
  lastUpdatedAt: number;
}

export function PowerupLedgerPanel({
  user,
  ledger,
  boxHistory,
}: {
  user: UserInventorySnapshot;
  ledger: PowerupLedgerEntry[];
  boxHistory: BoxDropRecord[];
}) {
  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 font-bold text-white">User: {user.username}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-white/60">User ID:</span>
            <code className="ml-2 rounded bg-black/30 px-1 text-xs text-white/80">{user.userId}</code>
          </div>
          <div>
            <span className="text-white/60">Last Updated:</span>
            <span className="ml-2 text-white">
              {new Date(user.lastUpdatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 font-bold text-white">Current Powerups</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Object.entries(user.powerups).map(([id, count]) => (
            <div key={id} className="rounded-lg bg-white/5 p-2">
              <div className="text-xs text-white/60">{id}</div>
              <div className="text-lg font-bold text-white">{count}</div>
            </div>
          ))}
          {Object.keys(user.powerups).length === 0 && (
            <div className="col-span-full text-sm text-white/40">No powerups</div>
          )}
        </div>
      </section>

      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 font-bold text-white">Boxes</h3>
        <div className="flex gap-4">
          {(["normal", "rare", "legendary", "mythic"] as BoxTier[]).map((tier) => (
            <div key={tier} className="rounded-lg bg-white/5 p-3">
              <div className="text-xs capitalize text-white/60">{tier}</div>
              <div className="text-xl font-bold text-white">{user.boxes[tier] ?? 0}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 font-bold text-white">Recent Powerup Transactions</h3>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/50 text-left text-white/60">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Powerup</th>
                <th className="p-2">Delta</th>
                <th className="p-2">Source</th>
                <th className="p-2">Table</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {ledger.slice(0, 50).map((entry, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-2 text-xs">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2 font-mono text-xs">{entry.powerupId}</td>
                  <td className={`p-2 font-bold ${entry.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {entry.delta > 0 ? "+" : ""}{entry.delta}
                  </td>
                  <td className="p-2 text-xs capitalize">{entry.source.replace(/_/g, " ")}</td>
                  <td className="p-2 text-xs">{entry.tableId ?? "—"}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-white/40">
                    No transactions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass rounded-xl p-4">
        <h3 className="mb-3 font-bold text-white">Box Drop History</h3>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/50 text-left text-white/60">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Tier</th>
                <th className="p-2">Source</th>
                <th className="p-2">State</th>
                <th className="p-2">Contents</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {boxHistory.slice(0, 50).map((box, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-2 text-xs">
                    {new Date(box.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2 capitalize">{box.tier}</td>
                  <td className="p-2 text-xs capitalize">{box.source.replace(/_/g, " ")}</td>
                  <td className={`p-2 text-xs ${box.state === "opened" ? "text-emerald-400" : "text-amber-400"}`}>
                    {box.state}
                  </td>
                  <td className="p-2 text-xs">
                    {box.contents?.map((c) => c.powerupId).join(", ") ?? "—"}
                  </td>
                </tr>
              ))}
              {boxHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-white/40">
                    No box drops
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
