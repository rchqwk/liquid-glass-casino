"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/authClient";

export function SignInGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, discordMode, discordError, retryDiscord } = useAuth();
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAllowed = useMemo(() => {
    // Always allow the dedicated profile page so users can manage sign-in/out.
    if (pathname === "/casino/profile") return true;
    return false;
  }, [pathname]);

  const blocked = !isAllowed && !loading && !user;

  return (
    <div className="relative">
      {children}

      {blocked ? (
        <div className="absolute inset-0 z-30">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative flex h-full w-full items-center justify-center p-4">
            <div className="glass glass-shine w-full max-w-md rounded-3xl p-6">
              {discordMode ? (
                <>
                  <h3 className="text-lg font-semibold text-white">Signing in with Discord…</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    This session is running inside Discord, so we use your Discord account automatically.
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-sm text-white/70">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
                    Connecting…
                  </div>
                  {discordError ? <p className="mt-3 text-sm text-rose-200">{discordError}</p> : null}
                  <button
                    type="button"
                    className="mt-4 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
                    onClick={retryDiscord}
                  >
                    Retry Discord sign-in
                  </button>
                  <p className="mt-3 text-[11px] leading-5 text-white/55">
                    If this keeps failing, re-launch the Activity from the voice channel.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-white">Sign in to play</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Choose a username to start playing. (Prototype only — no passwords.)
                  </p>

                  <label className="mt-4 block text-xs font-medium text-white/70">Username</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. tim"
                    autoFocus
                  />

                  <button
                    type="button"
                    className="mt-4 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
                    disabled={busy}
                    onClick={async () => {
                      setMsg(null);
                      setBusy(true);
                      try {
                        const res = await signIn(username);
                        if (!res.ok) setMsg(res.error);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>

                  <p className="mt-3 text-[11px] leading-5 text-white/55">
                    Allowed: letters/numbers/underscore. We’ll normalize spaces to underscores.
                  </p>
                  {msg ? <p className="mt-3 text-sm text-rose-200">{msg}</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
