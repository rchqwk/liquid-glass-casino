"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/authClient";

export function SignInGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, discordMode, discordError, retryDiscord } = useAuth();
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discordUrl, setDiscordUrl] = useState<string | null>(null);
  const [discordElapsed, setDiscordElapsed] = useState(0);

  const isAllowed = useMemo(() => {
    // Always allow the dedicated profile page so users can manage sign-in/out.
    if (pathname === "/casino/profile") return true;
    // Allow tutorial / docs pages without forcing sign-in (useful for first-time visitors).
    if (pathname === "/casino/tutorial") return true;
    if (pathname === "/casino/blackjack/rules") return true;
    if (pathname === "/casino/blackjack/special-rules") return true;
    if (pathname === "/casino/blackjack/strategy") return true;
    return false;
  }, [pathname]);

  const blocked = !isAllowed && !loading && !user;

  // If Discord sign-in is taking too long, offer a temporary username fallback.
  useEffect(() => {
    if (!blocked) return;
    if (!discordMode) return;
    setDiscordElapsed(0);
    const id = window.setInterval(() => setDiscordElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [blocked, discordMode]);

  // iOS Discord sometimes opens the app without `frame_id`, which prevents the Embedded App SDK.
  // If that happens, automatically fall back to our OAuth-based Discord entry page.
  useEffect(() => {
    if (!discordMode) return;
    if (!discordError) return;
    if (!discordError.includes("frame_id")) return;
    try {
      const key = "lgc.discord.fallback.tried";
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.setTimeout(() => retryDiscord(), 50);
    } catch {
      // ignore
    }
  }, [discordMode, discordError, retryDiscord]);

  useEffect(() => {
    if (discordMode) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";

    // Web version on rchqwk.com uses a root redirect URI and broader scopes.
    if (hostname === "rchqwk.com") {
      try {
        sessionStorage.setItem("lgc.discord.webReturnTo", returnTo);
      } catch {
        // ignore
      }
      const url = new URL("https://discord.com/oauth2/authorize");
      url.searchParams.set("client_id", "1512024820194349157");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", origin || "https://rchqwk.com");
      url.searchParams.set(
        "scope",
        "activities.write activities.invites.write activities.read identify",
      );
      setDiscordUrl(url.toString());
      return;
    }

    const clientId =
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
    if (!clientId) return;
    const redirectUri =
      process.env.NEXT_PUBLIC_DISCORD_WEB_REDIRECT_URI ??
      "https://rchqwk-liquid-glass-casino.vercel.app/discord/callback";
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", returnTo);
    setDiscordUrl(url.toString());
  }, [discordMode]);

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
                    Connecting… <span className="font-mono text-white/55">{discordElapsed}s</span>
                  </div>
                  {discordError ? <p className="mt-3 text-sm text-rose-200">{discordError}</p> : null}
                  <button
                    type="button"
                    className="mt-4 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
                    onClick={retryDiscord}
                  >
                    Retry Discord sign-in
                  </button>
                  {discordElapsed >= 12 || (discordError && discordError.toLowerCase().includes("handshake timed out")) ? (
                    <button
                      type="button"
                      className="mt-3 glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                      onClick={() => {
                        // Let iOS users bypass the embedded handshake and play with a username.
                        // We must clear the persisted "embedded" flag so the app doesn't force Discord mode.
                        try {
                          sessionStorage.removeItem("lgc.discord.embedded");
                          sessionStorage.removeItem("lgc.discord.qs");
                          sessionStorage.removeItem("lgc.discord.fallback.tried");
                          sessionStorage.removeItem("lgc.discord.oauthAutoRedirected");
                        } catch {
                          // ignore
                        }
                        window.location.href = "/casino/blackjack-v2";
                      }}
                    >
                      Play with username (temporary)
                    </button>
                  ) : null}
                  <p className="mt-3 text-[11px] leading-5 text-white/55">
                    If this keeps failing, re-launch the Activity from the voice channel.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-white">Sign in to play</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Choose a username to start playing. Quick sign-in for play-money tables.
                  </p>

                  {discordUrl ? (
                    <>
                      <a
                        className="mt-4 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500/30"
                        href={discordUrl}
                      >
                        Sign in with Discord
                      </a>
                      <div className="mt-3 text-[11px] text-white/50">or continue with a local username</div>
                    </>
                  ) : null}

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
