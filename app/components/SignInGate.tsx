"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CasinoDialog } from "./casino/CasinoDialog";
import { useAuth } from "../lib/authClient";

export function SignInGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signInWithCredential, discordMode, discordError, retryDiscord, sessionExpired } = useAuth();
  const pathname = usePathname();
  const [requested, setRequested] = useState(false);
  useEffect(() => { const request = () => setRequested(true); window.addEventListener("lgc:signIn", request); return () => window.removeEventListener("lgc:signIn", request); }, []);
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [credKind, setCredKind] = useState<"password" | "passcode">("password");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [needsClaim, setNeedsClaim] = useState(false);
  const [discordUrl, setDiscordUrl] = useState<string | null>(null);
  const [discordElapsed, setDiscordElapsed] = useState(0);

  const isAllowed = useMemo(() => {
    if (process.env.NODE_ENV === "development" && pathname === "/casino/ui-preview") return true;
    if (["/casino", "/casino/blackjack-v2", "/casino/blackjack", "/casino/legacy", "/casino/games"].includes(pathname)) return true;
    // Always allow the dedicated profile page so users can manage sign-in/out.
    if (pathname === "/casino/profile") return true;
    // Allow tutorial / docs pages without forcing sign-in (useful for first-time visitors).
    if (pathname === "/casino/tutorial") return true;
    if (pathname === "/casino/blackjack/rules") return true;
    if (pathname === "/casino/blackjack/special-rules") return true;
    if (pathname === "/casino/blackjack/strategy") return true;
    // The Discord OAuth entry pages drive their own auth flow + pairing UI.
    if (pathname === "/casino/blackjack-v2/discord") return true;
    if (pathname === "/casino/blackjack/discord") return true;
    return false;
  }, [pathname]);

  const blocked = (!isAllowed || requested) && !loading && !user;

  // If Discord sign-in is taking too long, offer a temporary username fallback.
  useEffect(() => {
    if (!blocked) return;
    if (!discordMode) return;
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
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";

    // Web version on rchqwk.com uses a root redirect URI and broader scopes.
    if (hostname === "rchqwk.com" || hostname === "www.rchqwk.com") {
      try {
        sessionStorage.setItem("lgc.discord.webReturnTo", returnTo);
      } catch {
        // ignore
      }
      const url = new URL("https://discord.com/oauth2/authorize");
      url.searchParams.set("client_id", process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK || "1512024820194349157");
      url.searchParams.set("response_type", "code");
      const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "https://rchqwk.com";
      url.searchParams.set("redirect_uri", redirectUri);
      try { sessionStorage.setItem("lgc.discord.redirectUri", redirectUri); } catch { /* Cookies still support browser login. */ }
      url.searchParams.set("state", returnTo);
      url.searchParams.set(
        "scope",
        "activities.write activities.invites.write activities.read identify",
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- OAuth needs the browser origin and session return path.
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
      <div inert={blocked}>{children}</div>

      {blocked ? (
        <CasinoDialog open={blocked} onClose={() => setRequested(false)} dismissible={isAllowed} title="Sign in to play">
          <div className="max-w-md mx-auto">
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
                        // Let Discord users bypass OAuth for this browser session and fall back to the normal username gate.
                        try {
                          sessionStorage.setItem("lgc.discord.disableOauthSession", "1");
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
                  <p className="text-sm font-semibold text-white">Keep your seat and progress together.</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    New here? Create a username profile. Returning players should use their password, passcode, or Discord account.
                  </p>

                  {sessionExpired ? (
                    <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                      Your session expired. Sign in again to pick up where you left off.
                    </div>
                  ) : null}

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

                  <label htmlFor="casino-auth-username" className="mt-4 block text-xs font-medium text-white/70">Username</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                    id="casino-auth-username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. tim"
                    autoFocus
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={credKind === "password" ? "rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white" : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10"}
                      onClick={() => setCredKind("password")}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      className={credKind === "passcode" ? "rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white" : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10"}
                      onClick={() => setCredKind("passcode")}
                    >
                      6-digit passcode
                    </button>
                  </div>

                  <label htmlFor="casino-auth-credential" className="mt-3 block text-xs font-medium text-white/70">{credKind === "passcode" ? "Passcode" : "Password"}</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                    id="casino-auth-credential"
                    autoComplete="current-password"
                    value={credential}
                    onChange={(e) => setCredential(credKind === "passcode" ? e.target.value.replace(/\D/g, "") : e.target.value)}
                    placeholder={credKind === "passcode" ? "••••••" : "••••••••"}
                    type="password"
                    inputMode={credKind === "passcode" ? "numeric" : undefined}
                    maxLength={credKind === "passcode" ? 6 : undefined}
                  />
                  <p className="mt-1 text-[11px] text-white/40">A blank credential creates a new profile only. Existing accounts require proof of ownership.</p>

                  <button
                    type="button"
                    className="mt-4 glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-40"
                    disabled={busy}
                    onClick={async () => {
                      setMsg(null);
                      setNeedsAccount(false);
                      setNeedsClaim(false);
                      setBusy(true);
                      try {
                        const hasCredential = credential.trim().length > 0;
                        const res = hasCredential
                          ? await signInWithCredential(username.trim(), credential, credKind)
                          : await signIn(username);
                        if (!res.ok) {
                          setMsg(res.error);
                          if ("requiresAccount" in res && res.requiresAccount) {
                            setNeedsAccount(true);
                            setNeedsClaim(("requiresClaim" in res && res.requiresClaim) === true);
                          }
                        } else {
                          setRequested(false);
                          setCredential("");
                        }
                      } catch { setMsg("Sign-in could not complete. Check your connection and retry."); } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>

                  {needsAccount ? (
                    needsClaim ? (
                      <a
                        className="mt-3 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        href={"/account?returnTo=" + encodeURIComponent(typeof window === "undefined" ? pathname : window.location.pathname + window.location.search)}
                      >
                        Recover or secure your account
                      </a>
                    ) : (
                      <p className="mt-3 text-sm leading-5 text-amber-200">Enter your password or passcode above to sign in.</p>
                    )
                  ) : null}

                  <p className="mt-3 text-[11px] leading-5 text-white/55">
                    Allowed: letters/numbers/underscore. We’ll normalize spaces to underscores.
                  </p>
                  {msg ? <p className="mt-3 text-sm text-rose-200">{msg}</p> : null}
                </>
              )}
            {!isAllowed ? <Link className="casino-button casino-secondary mt-4" href="/casino/blackjack-v2">Back to lobby</Link> : null}
          </div>
        </CasinoDialog>
      ) : null}
    </div>
  );
}
