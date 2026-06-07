"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/authClient";

type GameConfig = {
  diceHouseEdge: number;
  slotsPayoutScale: number;
};

export default function AdminPage() {
  const { user } = useAuth();
  const role = user?.role_level ?? 0;

  const [config, setConfig] = useState<GameConfig | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [targetUser, setTargetUser] = useState("");
  const [targetRole, setTargetRole] = useState(1);
  const [wipeUser, setWipeUser] = useState("");

  const [diceHouseEdge, setDiceHouseEdge] = useState(0.01);
  const [slotsPayoutScale, setSlotsPayoutScale] = useState(1.0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { config: GameConfig };
        setConfig(data.config);
        setDiceHouseEdge(data.config.diceHouseEdge);
        setSlotsPayoutScale(data.config.slotsPayoutScale);
      } catch {
        // ignore
      }
    })();
  }, []);

  const roleLabel = useMemo(() => {
    if (role >= 3) return "Admin L3";
    if (role >= 2) return "Admin L2";
    if (role >= 1) return "Admin L1";
    return "User";
  }, [role]);

  if (role < 1) {
    return (
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Admin</h2>
        <p className="mt-2 text-sm text-white/70">
          You don’t have access. Sign in as an admin username.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Admin Panel</h2>
          <span className="rounded-2xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
            {roleLabel}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Admin users are hidden from the public leaderboard.
        </p>
      </div>

      {msg ? (
        <div className="glass-soft glass-shine rounded-3xl p-4 text-sm text-white/80">
          {msg}
        </div>
      ) : null}

      {/* Level 1: view config */}
      <div className="glass-soft glass-shine rounded-3xl p-5">
        <p className="text-sm font-medium text-white">Game config (read)</p>
        <p className="mt-2 text-xs text-white/60">
          Dice house edge: <span className="font-mono text-white/80">{config?.diceHouseEdge ?? "—"}</span>
          {" • "}
          Slots payout scale: <span className="font-mono text-white/80">{config?.slotsPayoutScale ?? "—"}</span>
        </p>
      </div>

      {/* Level 2: moderation */}
      <div className="glass-soft glass-shine rounded-3xl p-5">
        <p className="text-sm font-medium text-white">Moderation (Level 2+)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
            disabled={role < 2}
            onClick={async () => {
              setMsg(null);
              const res = await fetch("/api/admin/reset-leaderboard", { method: "POST" });
              setMsg(res.ok ? "Leaderboard reset." : "Failed to reset leaderboard.");
            }}
          >
            Reset leaderboard
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="sm:col-span-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            placeholder="username to wipe (stats)"
            value={wipeUser}
            onChange={(e) => setWipeUser(e.target.value)}
            disabled={role < 2}
          />
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
            disabled={role < 2 || !wipeUser.trim()}
            onClick={async () => {
              setMsg(null);
              const res = await fetch("/api/admin/wipe-user", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username: wipeUser }),
              });
              setMsg(res.ok ? `Wiped stats for ${wipeUser}.` : "Failed to wipe user.");
            }}
          >
            Wipe user
          </button>
        </div>
      </div>

      {/* Level 3: config updates */}
      <div className="glass-soft glass-shine rounded-3xl p-5">
        <p className="text-sm font-medium text-white">Game controls (Level 3+)</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/60">
            Dice house edge (0–0.10)
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              type="number"
              step={0.001}
              min={0}
              max={0.1}
              value={diceHouseEdge}
              disabled={role < 3}
              onChange={(e) => setDiceHouseEdge(Number(e.target.value))}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            />
          </label>
          <label className="text-xs text-white/60">
            Slots payout scale (0.1–10)
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              type="number"
              step={0.1}
              min={0.1}
              max={10}
              value={slotsPayoutScale}
              disabled={role < 3}
              onChange={(e) => setSlotsPayoutScale(Number(e.target.value))}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-3 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          disabled={role < 3}
          onClick={async () => {
            setMsg(null);
            const res = await fetch("/api/admin/config", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ diceHouseEdge, slotsPayoutScale }),
            });
            if (res.ok) {
              const data = (await res.json()) as { config: GameConfig };
              setConfig(data.config);
              setMsg("Config saved.");
            } else setMsg("Failed to save config.");
          }}
        >
          Save config
        </button>
      </div>

      {/* Master-only: set roles */}
      <div className="glass-soft glass-shine rounded-3xl p-5">
        <p className="text-sm font-medium text-white">User roles (Master only)</p>
        <p className="mt-2 text-xs text-white/60">
          Set admin level 1–3 for a username. Master username is configured by{" "}
          <span className="font-mono">LGC_MASTER_USERNAME</span> (default: master).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="sm:col-span-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            placeholder="username"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
          />
          <select
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            value={targetRole}
            onChange={(e) => setTargetRole(Number(e.target.value))}
          >
            <option value={0}>0 (User)</option>
            <option value={1}>1 (Admin)</option>
            <option value={2}>2 (Mod)</option>
            <option value={3}>3 (Super)</option>
          </select>
        </div>
        <button
          type="button"
          className="mt-3 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
          onClick={async () => {
            setMsg(null);
            const res = await fetch("/api/admin/set-role", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ username: targetUser, role_level: targetRole }),
            });
            setMsg(res.ok ? `Updated role for ${targetUser}.` : "Failed to update role (must be master).");
          }}
        >
          Set role
        </button>
      </div>
    </div>
  );
}
