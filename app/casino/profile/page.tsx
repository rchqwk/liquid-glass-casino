"use client";

import { useState } from "react";
import { useAuth } from "../../lib/authClient";

export default function ProfilePage() {
  const { user, loading, signIn, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Username-only sign-in for this prototype. No passwords (not secure for
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
            <div className="flex gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
                onClick={async () => {
                  await signOut();
                  setMsg("Signed out.");
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
                  else setMsg("Signed in.");
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

