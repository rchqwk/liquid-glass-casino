"use client";

import { useState } from "react";
import { useAuth } from "../../lib/authClient";

export default function ProfilePage() {
  const { user, loading, signIn, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [inactivePrompt, setInactivePrompt] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Username-only sign-in for the play-money service. No passwords (not secure for
          real money).
        </p>
      </div>

      <div className="glass-soft glass-shine rounded-3xl p-5">
        {loading ? (
          <p className="text-sm text-white/70">Loading…</p>
        ) : user ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/80">
              Signed in as <span className="font-semibold text-white">@{user.username}</span>
            </p>
              {inactivePrompt ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-medium text-white">Leaderboard inactivity</p>
                  <p className="mt-1 text-xs leading-5 text-white/60">
                    Your stats were hidden due to inactivity (30+ days). Do you want to keep your old progress?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10"
                      onClick={async () => {
                        setMsg(null);
                        const res = await fetch("/api/leaderboard/reactivate", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ keep: true }),
                        });
                        if (res.ok) {
                          setInactivePrompt(false);
                          setMsg("Progress kept and leaderboard re-enabled.");
                        } else setMsg("Failed to reactivate.");
                      }}
                    >
                      Keep progress
                    </button>
                    <button
                      type="button"
                      className="glass-soft rounded-2xl bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25"
                      onClick={async () => {
                        setMsg(null);
                        const res = await fetch("/api/leaderboard/reactivate", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ keep: false }),
                        });
                        if (res.ok) {
                          setInactivePrompt(false);
                          setMsg("Progress reset and leaderboard re-enabled.");
                        } else setMsg("Failed to reset/reactivate.");
                      }}
                    >
                      Reset progress
                    </button>
                  </div>
                </div>
              ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
                onClick={async () => {
                  await signOut();
                  setMsg("Signed out.");
                    setInactivePrompt(false);
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-white/70">Username</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. tim"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
                onClick={async () => {
                  setMsg(null);
                  const res = await signIn(username);
                  if (!res.ok) setMsg(res.error);
                  else {
                    setMsg("Signed in.");
                    setInactivePrompt(!!res.inactivePrompt);
                  }
                }}
              >
                Sign in
              </button>
            </div>
            <p className="text-[11px] leading-5 text-white/55">
              Allowed: letters/numbers/underscore. We’ll normalize spaces to underscores.
            </p>
          </div>
        )}

        {msg ? <p className="mt-3 text-sm text-white/70">{msg}</p> : null}
      </div>
    </div>
  );
}
