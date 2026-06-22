"use client";

const POWERUP_CATEGORIES = ["boosts", "saves", "utility", "magic", "dealer", "mythic"] as const;

export function BlackjackHostPanel({
  open,
  hostSaving,
  hostTurnMs,
  hostAfkKick,
  hostDisabled,
  hostPasswordEnabled,
  hostPassword,
  onClose,
  onChangeTurnMs,
  onChangeAfkKick,
  onToggleDisabled,
  onChangePasswordEnabled,
  onChangePassword,
  onSave,
}: {
  open: boolean;
  hostSaving: boolean;
  hostTurnMs: 30_000 | 60_000;
  hostAfkKick: boolean;
  hostDisabled: Record<string, boolean>;
  hostPasswordEnabled: boolean;
  hostPassword: string;
  onClose: () => void;
  onChangeTurnMs: (value: 30_000 | 60_000) => void;
  onChangeAfkKick: (value: boolean) => void;
  onToggleDisabled: (category: string, value: boolean) => void;
  onChangePasswordEnabled: (value: boolean) => void;
  onChangePassword: (value: string) => void;
  onSave: () => Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
      <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Host options</div>
            <div className="mt-1 text-xs text-white/60">Only Player 1 (seat 1) can edit these.</div>
          </div>
          <button
            type="button"
            className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
            onClick={() => {
              if (hostSaving) return;
              onClose();
            }}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-white/80">Turn time</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                  hostTurnMs === 30_000 ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                onClick={() => onChangeTurnMs(30_000)}
              >
                30s
              </button>
              <button
                type="button"
                className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                  hostTurnMs === 60_000 ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                onClick={() => onChangeTurnMs(60_000)}
              >
                1m
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-white/80">AFK kick</div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={hostAfkKick} onChange={(e) => onChangeAfkKick(e.target.checked)} />
              Enable AFK kick (miss 5 rounds)
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-white/80">Disable powerups</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70 sm:grid-cols-3">
            {POWERUP_CATEGORIES.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={!!hostDisabled[k]} onChange={(e) => onToggleDisabled(k, e.target.checked)} />
                {k}
              </label>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-white/50">Disabled categories cannot be used by any player in this room.</div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-white/80">Password</div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={hostPasswordEnabled} onChange={(e) => onChangePasswordEnabled(e.target.checked)} />
            Require password to join
          </label>
          {hostPasswordEnabled ? (
            <input
              type="text"
              value={hostPassword}
              onChange={(e) => onChangePassword(e.target.value)}
              placeholder="Set room password"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          ) : null}
          {hostPasswordEnabled ? (
            <div className="mt-2 text-[11px] text-white/50">Note: you must enter the password when saving (it is not shown back to you).</div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
            disabled={hostSaving}
            onClick={() => void onSave()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
