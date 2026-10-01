"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/authClient";
import { getDiscordSdk, withDiscordTimeout, exchangeDiscordCode, discordReturnPath } from "../../../lib/discordClient";
import { useEffect, useMemo, useState } from "react";

type Stage =
  | "init"
  | "awaiting_oauth"
  | "authorizing"
  | "logging_in"
  | "ensuring_table"
  | "redirecting"
  | "linked"
  | "error";

// Canonical OAuth redirect target (must match the redirect URI registered in the
// Discord Developer Portal and DISCORD_REDIRECT_URI in .env / Vercel env vars).
const CANONICAL_REDIRECT_URI = "https://rchqwk.com/casino/blackjack-v2/discord";

const TABLE_BASE = "/casino/blackjack-v2";

export default function DiscordV2EntryPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [stage, setStage] = useState<Stage>("init");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mobileAuth, setMobileAuth] = useState<null | { token: string; code: string; channelId?: string | null; expiresAt: number }>(null);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ??
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ??
    "";
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? CANONICAL_REDIRECT_URI;

  const addLog = (msg: string) => {
    try {
      const t = new Date().toISOString().split("T")[1]?.split(".")[0] ?? "";
      setLogs((prev) => [...prev.slice(-30), `${t} ${msg}`]);
    } catch {
      // ignore
    }
  };

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  useEffect(() => {
    setIsReady(true);
    addLog("Entry page mounted");
    addLog(`redirectUri=${redirectUri}`);
  }, [redirectUri]);

  const hasFrameId = useMemo(() => !!qs?.get("frame_id"), [qs]);
  const channelIdFromQuery = useMemo(() => qs?.get("channel_id") ?? null, [qs]);
  const oauthCodeFromQuery = useMemo(() => qs?.get("code") ?? null, [qs]);
  const oauthStateFromQuery = useMemo(() => qs?.get("state") ?? null, [qs]);

  // state=mobile:CODE is used by the /discord/mobile pairing flow.
  const mobileAuthCode = useMemo(() => {
    const raw = String(oauthStateFromQuery ?? "");
    return raw.startsWith("mobile:")
      ? raw.slice("mobile:".length).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
      : null;
  }, [oauthStateFromQuery]);

  // If we initiated OAuth ourselves we store the channel id in `state`.
  const channelId = channelIdFromQuery ?? (!mobileAuthCode && /^\d{15,22}$/.test(oauthStateFromQuery ?? "") ? oauthStateFromQuery : null);

  const isMobile = useMemo(() => {
    try {
      if (typeof navigator === "undefined") return false;
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent ?? "");
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Browser pairing code creation (only after SDK path is exhausted)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile && !hasFrameId) return;
    if (oauthCodeFromQuery) return;
    if (mobileAuth) return;
    if (stage !== "awaiting_oauth") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discord/mobile-auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelId }),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || !data?.token || !data?.code) throw new Error(data?.error ?? "Failed to create mobile auth code");
        if (cancelled) return;
        addLog(`Pairing code created: ${data.code}`);
        setMobileAuth({
          token: String(data.token),
          code: String(data.code),
          channelId: (data.channelId ?? channelId ?? null) as string | null,
          expiresAt: Number(data.expiresAt ?? 0) || Date.now() + 15 * 60 * 1000,
        });
      } catch (e: any) {
        if (cancelled) return;
        addLog(`Pairing code creation failed: ${e?.message ?? "unknown"}`);
        setStage("error");
        setErr(String(e?.message ?? "Failed to initialize mobile Discord sign-in."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMobile, hasFrameId, oauthCodeFromQuery, mobileAuth, channelId, stage]);

  // ─────────────────────────────────────────────────────────────
  // Mobile pairing poll: wait for the code to be used on another device
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile && !hasFrameId) return;
    if (!mobileAuth?.token) return;
    if (oauthCodeFromQuery) return;
    let cancelled = false;
    let pending = false;
    const poll = async () => {
      if (pending || cancelled) return;
      if (Date.now() >= mobileAuth.expiresAt) {
        setMobileAuth(null);
        setStage("error");
        setErr("Pairing expired. Restart the Activity to get a fresh code.");
        return;
      }
      pending = true;
      try {
        const res = await fetch(`/api/discord/mobile-auth?token=${encodeURIComponent(mobileAuth.token)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) return;
        if (cancelled) return;
        if (data?.status === "completed" && data?.sessionToken) {
          try {
            localStorage.setItem("lgc.session", String(data.sessionToken));
          } catch {
            // ignore
          }
          addLog("Pairing completed, session stored");
          setStage("redirecting");
          const nextChannelId = String(data?.channelId ?? mobileAuth.channelId ?? "").trim();
          await refresh();
          router.replace(nextChannelId ? `${TABLE_BASE}/${encodeURIComponent(nextChannelId)}` : TABLE_BASE);
        }
      } catch {
        // ignore transient poll failures
      } finally {
        pending = false;
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isMobile, hasFrameId, mobileAuth, oauthCodeFromQuery]);

  const persistSession = (token: string | null | undefined) => {
    if (!token) return;
    try {
      localStorage.setItem("lgc.session", String(token));
    } catch {
      // ignore
    }
  };

  const joinTableFlow = async (targetChannelId: string | null | undefined) => {
    if (!targetChannelId) return;
    setStage("ensuring_table");
    const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(targetChannelId)}/ensure`, { method: "POST" });
    const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
    if (!ensureRes.ok) throw new Error(ensureJson?.error ?? "Failed to create/join table.");
    const joinRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(targetChannelId)}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spectate: false }),
    });
    if (!joinRes.ok) throw new Error("Could not join the table. Please retry.");
  };

  // ─────────────────────────────────────────────────────────────
  // Main auth cascade
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        if (!clientId) throw new Error("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID");
        addLog(`hasFrameId=${hasFrameId} hasCode=${!!oauthCodeFromQuery} channelId=${channelId} isMobile=${isMobile}`);

        // ── PATH 1: OAuth callback (code in URL) ─────────────────
        if (oauthCodeFromQuery) {
          addLog("PATH 1: OAuth callback");
          setStage("logging_in");
          const loginJson = await exchangeDiscordCode(oauthCodeFromQuery, redirectUri, mobileAuthCode);
          persistSession(loginJson?.session_token);
          addLog("Login OK (OAuth)");

          // If this was a mobile pairing completion, the Activity polls for it.
          if (mobileAuthCode) {
            setStage("linked");
            return;
          }

          if (channelId) await joinTableFlow(channelId);
          if (cancelled) return;
          setStage("redirecting");
          await refresh();
          router.replace(channelId ? `${TABLE_BASE}/${encodeURIComponent(channelId)}` : discordReturnPath(oauthStateFromQuery));
          return;
        }

        // ── PATH 2: Embedded SDK (frame_id present) ─────────────
        if (hasFrameId) {
          addLog("PATH 2: Embedded App SDK");
          try {
            const discordSdk = await getDiscordSdk(clientId);
            addLog("Shared SDK loaded");
            addLog("Waiting for SDK ready…");
            await withDiscordTimeout(discordSdk.ready(), "Discord client handshake timed out. Use browser pairing below.", isMobile ? 10000 : 12000);
            if (cancelled) return;
            addLog("SDK ready");

            const sdkChannelId = (discordSdk as any).channelId as string | undefined;
            const effectiveChannelId = sdkChannelId ?? channelId;
            if (!effectiveChannelId) {
              addLog("Missing channel id");
              throw new Error("Missing channel id (must be launched from a voice call Activity).");
            }

            setStage("authorizing");
            const authz = await withDiscordTimeout(discordSdk.commands.authorize({
              client_id: clientId,
              response_type: "code",
              prompt: "none",
              scope: ["identify", "rpc.activities.write"],
            }), "Discord authorization timed out. Use browser pairing below.");
            const sdkCode = String(authz?.code ?? "");
            if (!sdkCode) throw new Error("Discord authorize did not return a code.");
            addLog("Got SDK auth code");

            setStage("logging_in");
            const loginJson = await exchangeDiscordCode(sdkCode, redirectUri);
            persistSession(loginJson?.session_token);
            addLog("Login OK (SDK)");

            const accessToken = String(loginJson?.access_token ?? "");
            if (accessToken) {
              try {
                await withDiscordTimeout(discordSdk.commands.authenticate({ access_token: accessToken }), "Discord authentication timed out.");
                addLog("authenticate() OK");
              } catch (authErr: any) {
                addLog(`authenticate() failed: ${authErr?.message ?? "unknown"}`);
              }
            }

            await joinTableFlow(effectiveChannelId);
            if (cancelled) return;
            setStage("redirecting");
            await refresh();
            router.replace(`${TABLE_BASE}/${encodeURIComponent(effectiveChannelId)}`);
            return;
          } catch (sdkErr: any) {
            const msg = String(sdkErr?.message ?? "");
            addLog(`SDK error: ${msg}`);
            if (cancelled) return;
            // A failed Activity handshake must stop here, without reloading its iframe.
            setErr(msg);
            // Fall through to fallback path
          }
        }

        // ── PATH 3: Fallback ────────────────────────────────────
        addLog(`PATH 3: Fallback (isMobile=${isMobile})`);
        setStage("awaiting_oauth");
      } catch (e: any) {
        if (cancelled) return;
        addLog(`Fatal: ${e?.message ?? "unknown"}`);
        setStage("error");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const oauthAuthorizeUrl = useMemo(() => {
    if (!clientId) return null;
    const state = channelId ? `${TABLE_BASE}/${encodeURIComponent(channelId)}` : TABLE_BASE;
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify rpc.activities.write");
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }, [clientId, redirectUri, channelId]);

  const mobileLinkUrl = useMemo(() => {
    if (typeof window === "undefined") return "/discord/mobile";
    return "https://rchqwk.com/discord/mobile";
  }, []);

  const progress = useMemo(() => {
    if (stage === "init") return 8;
    if (stage === "awaiting_oauth") return 18;
    if (stage === "authorizing") return 30;
    if (stage === "logging_in") return 55;
    if (stage === "ensuring_table") return 78;
    if (stage === "redirecting") return 95;
    if (stage === "linked") return 100;
    if (stage === "error") return 100;
    return 10;
  }, [stage]);

  const stageLabel = useMemo(() => {
    if (stage === "init") return "Connecting to Discord…";
    if (stage === "awaiting_oauth") return hasFrameId || isMobile ? "Continue with browser pairing" : "Continue with Discord to sign in";
    if (stage === "authorizing") return "Authorizing…";
    if (stage === "logging_in") return "Signing you in…";
    if (stage === "ensuring_table") return "Creating / joining table…";
    if (stage === "redirecting") return "Loading table…";
    if (stage === "linked") return "Discord sign-in completed.";
    return "Error";
  }, [stage, isMobile, hasFrameId]);

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: "100dvh",
        width: "100%",
        backgroundColor: "var(--void)",
        backgroundImage: "radial-gradient(1200px 600px at 50% -10%, rgba(0,245,255,0.04) 0%, transparent 60%)",
        padding: "40px 16px",
        color: "white",
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes nn-spin { to { transform: rotate(360deg); } }
        .nn-spinner { width: 32px; height: 32px; border-radius: 999px; border: 2px solid rgba(255,255,255,.22); border-top-color: var(--neon-cyan); animation: nn-spin 900ms linear infinite; }
        .nn-log-toggle { cursor: pointer; color: rgba(255,255,255,.45); text-decoration: underline; }
        .nn-log-toggle:hover { color: rgba(255,255,255,.8); }
      `}</style>

      <div className="nn-card nn-fade-in p-6 text-center" style={{ maxWidth: 480 }}>
        <div className="text-lg font-bold text-white">Launching Discord Blackjack…</div>
        <div className="mt-2 text-sm text-white/70">{stageLabel}</div>

        <div className="mt-4">
          <div className="nn-badge nn-badge-cyan text-xs">
            {progress}% · <span className="font-mono">{stage}</span>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
        ) : null}

        {stage === "linked" ? (
          <div className="mt-4 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            Discord sign-in completed. Return to the Discord Activity to continue.
          </div>
        ) : null}

        {!hasFrameId && !oauthCodeFromQuery ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <div className="font-semibold text-white/90">Not launched from Discord</div>
            <div className="mt-2">
              Launch this as a Discord Activity from a voice channel:{" "}
              <span className="font-mono text-neon-cyan">Rocket → your app → Start</span>
            </div>
          </div>
        ) : null}

        {stage === "awaiting_oauth" && mobileAuth ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            <div className="font-semibold text-white">Browser pairing code</div>
            <div className="mt-3 font-mono text-2xl tracking-widest text-neon-cyan">{mobileAuth.code}</div>
            <div className="mt-3 text-xs text-white/60">
              Open <span className="font-mono text-neon-magenta">{mobileLinkUrl}</span> in your browser, enter the code
              above, and complete Discord sign-in.
            </div>
          </div>
        ) : null}

        {stage === "awaiting_oauth" && !hasFrameId && !isMobile && oauthAuthorizeUrl ? <a className="casino-button casino-primary mt-4" href={oauthAuthorizeUrl}>Continue with Discord</a> : null}
        {stage === "awaiting_oauth" && hasFrameId ? <p className="casino-muted mt-4 text-sm">The Discord connection did not finish. Open rchqwk.com/discord/mobile in your browser and enter the pairing code. This page will continue when linked.</p> : null}
        {stage === "error" ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              onClick={() => {
                try {
                  sessionStorage.setItem("lgc.discord.disableOauthSession", "1");
                } catch {
                  // ignore
                }
                const target = channelId ? `${TABLE_BASE}/${encodeURIComponent(channelId)}` : TABLE_BASE;
                // Username mode intentionally leaves SDK auth and reinitializes the provider.
                window.location.replace(target);
              }}
            >
              Play with temporary username
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            className="nn-log-toggle text-xs"
            onClick={() => setShowLogs((s) => !s)}
          >
            {showLogs ? "Hide debug log" : "Show debug log"}
          </button>
        </div>

        {showLogs ? (
          <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left font-mono text-[10px] leading-5 text-white/55">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
