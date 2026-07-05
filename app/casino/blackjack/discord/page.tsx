"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Pre-load the Discord SDK module as early as possible so the dynamic import
// inside the effect is already cached when we need it.
let _DiscordSDKModule: typeof import("@discord/embedded-app-sdk") | null = null;
void import("@discord/embedded-app-sdk").then((m) => {
  _DiscordSDKModule = m;
});

type Stage =
  | "booting"
  | "embedded_ready"
  | "embedded_authorizing"
  | "session_creating"
  | "authenticated"
  | "fallback_available"
  | "browser_pairing"
  | "redirecting"
  | "linked"
  | "failed";

type AuthTransaction = {
  id: string;
  kind: "embedded" | "browser_pairing";
  source: "activity" | "web";
  platform: "desktop" | "mobile" | "unknown";
  channelId: string | null;
  guildId: string | null;
  returnPath: string | null;
  pairingCode: string | null;
  status: "pending" | "completed" | "failed" | "expired";
  userId: number | null;
  sessionToken: string | null;
  error: string | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
};

export default function DiscordBlackjackEntryPage() {
  const BROWSER_PAIRING_TX_KEY = "lgc.discord.browserPairingTxId";
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("booting");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [browserPairingTx, setBrowserPairingTx] = useState<AuthTransaction | null>(null);

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk-liquid-glass-casino.vercel.app/casino/blackjack/discord";

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const hasFrameId = useMemo(() => !!qs?.get("frame_id"), [qs]);
  const channelId = useMemo(() => qs?.get("channel_id") ?? null, [qs]);
  const guildId = useMemo(() => qs?.get("guild_id") ?? null, [qs]);
  const oauthCodeFromQuery = useMemo(() => qs?.get("code") ?? null, [qs]);
  const oauthStateFromQuery = useMemo(() => qs?.get("state") ?? null, [qs]);
  const transactionIdFromQuery = useMemo(() => {
    const raw = String(oauthStateFromQuery ?? "").trim();
    return /^[a-f0-9]{48}$/i.test(raw) ? raw : null;
  }, [oauthStateFromQuery]);
  const isMobile = useMemo(() => {
    try {
      if (typeof navigator === "undefined") return false;
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent ?? "");
    } catch {
      return false;
    }
  }, []);

  const mobileLinkUrl = useMemo(() => {
    if (typeof window === "undefined") return "/discord/mobile";
    return `${window.location.origin}/discord/mobile`;
  }, []);

  const redirectIntoGame = useCallback(
    async (nextChannelId?: string | null) => {
      const resolved = String(nextChannelId ?? channelId ?? "").trim();
      if (resolved) {
        const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(resolved)}/ensure`, { method: "POST" });
        const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
        if (!ensureRes.ok) throw new Error(ensureJson?.error ?? "Failed to create/join table.");
        const joinRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(resolved)}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: false }),
        });
        if (!joinRes.ok) {
          const joinJson = (await joinRes.json().catch(() => ({}))) as any;
          throw new Error(joinJson?.error ?? "Failed to join table.");
        }
      }
      setStage("redirecting");
      router.replace(resolved ? `/casino/blackjack-v2/${encodeURIComponent(resolved)}` : "/casino/blackjack-v2");
    },
    [channelId, router],
  );

  const completeTransaction = useCallback(
    async (transactionId: string, code: string) => {
      setStage("session_creating");
      setErr(null);
      const res = await fetch("/api/discord/auth/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transactionId, code, redirectUri }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(data?.error ?? "Discord login failed.");
      if (data?.session_token) {
        try {
          localStorage.setItem("lgc.session", String(data.session_token));
        } catch {
          // ignore
        }
      }
      return data as { access_token?: string; session_token?: string; transaction?: AuthTransaction };
    },
    [redirectUri],
  );

  const beginBrowserPairing = useCallback(async () => {
    setErr(null);
    setStage("browser_pairing");
    const res = await fetch("/api/discord/auth/fallback/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "activity",
        platform: isMobile ? "mobile" : "desktop",
        channelId,
        guildId,
        returnPath: channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !data?.transaction?.id) {
      setStage("fallback_available");
      throw new Error(data?.error ?? "Failed to create browser pairing request");
    }
    const tx = data.transaction as AuthTransaction;
    try {
      sessionStorage.setItem(BROWSER_PAIRING_TX_KEY, tx.id);
    } catch {
      // ignore
    }
    setBrowserPairingTx(tx);
  }, [channelId, guildId, isMobile]);

  const startGuestMode = useCallback(() => {
    try {
      sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
      sessionStorage.setItem("lgc.discord.disableOauthSession", "1");
    } catch {
      // ignore
    }
    router.replace(channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2");
  }, [channelId, router]);

  const retryEmbeddedFlow = useCallback(() => {
    try {
      sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
      sessionStorage.removeItem("lgc.discord.disableOauthSession");
    } catch {
      // ignore
    }
    window.location.href = `/casino/blackjack/discord${window.location.search || ""}`;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (browserPairingTx?.id) return;
    if (oauthCodeFromQuery) return;
    let cancelled = false;
    (async () => {
      try {
        const storedTxId = sessionStorage.getItem(BROWSER_PAIRING_TX_KEY) ?? "";
        if (!storedTxId) return;
        const res = await fetch(`/api/discord/auth/status?tx=${encodeURIComponent(storedTxId)}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || cancelled) return;
        const tx = data?.transaction as AuthTransaction | undefined;
        if (!tx) return;
        if (tx.status === "pending") {
          setBrowserPairingTx(tx);
          setStage("browser_pairing");
          return;
        }
        if (tx.status === "completed" && tx.sessionToken) {
          try {
            localStorage.setItem("lgc.session", String(tx.sessionToken));
            sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
          } catch {
            // ignore
          }
          setStage("authenticated");
          await redirectIntoGame(tx.channelId);
          return;
        }
        try {
          sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [browserPairingTx?.id, oauthCodeFromQuery, redirectIntoGame]);

  useEffect(() => {
    if (!browserPairingTx?.id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/discord/auth/status?tx=${encodeURIComponent(browserPairingTx.id)}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || cancelled) return;
        const tx = data?.transaction as AuthTransaction | undefined;
        if (!tx) return;
        setBrowserPairingTx(tx);
        if (tx.status === "completed" && tx.sessionToken) {
          try {
            localStorage.setItem("lgc.session", String(tx.sessionToken));
            sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
          } catch {
            // ignore
          }
          setStage("authenticated");
          await redirectIntoGame(tx.channelId);
        } else if (tx.status === "failed" || tx.status === "expired") {
          try {
            sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
          } catch {
            // ignore
          }
          setStage("fallback_available");
          setErr(tx.error ?? "Discord browser pairing expired. Please retry.");
        }
      } catch {
        // ignore transient failures
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [browserPairingTx?.id, redirectIntoGame]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        if (!clientId) throw new Error("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID");

        if (browserPairingTx?.id && !oauthCodeFromQuery) {
          setStage("browser_pairing");
          return;
        }

        if (oauthCodeFromQuery && transactionIdFromQuery) {
          const completed = await completeTransaction(transactionIdFromQuery, oauthCodeFromQuery);
          if (cancelled) return;
          const tx = completed.transaction;
          if (tx?.kind === "browser_pairing" && !hasFrameId) {
            try {
              sessionStorage.removeItem(BROWSER_PAIRING_TX_KEY);
            } catch {
              // ignore
            }
            setStage("linked");
            setBrowserPairingTx(tx);
            return;
          }
          setStage("authenticated");
          await redirectIntoGame(tx?.channelId ?? channelId);
          return;
        }

        if (!hasFrameId) {
          setStage("failed");
          setErr("Discord Activity params are missing, so embedded sign-in could not start.");
          return;
        }

        setStage("booting");

        // ──────────────────────────────────────────────
        // Start the SDK handshake IMMEDIATELY, before any API calls.
        // Discord sends the READY postMessage payload exactly once per
        // Activity instance. If the SDK isn't listening when it arrives,
        // the handshake hangs forever.
        // Give extra time on mobile where the handshake can be slower.
        // ──────────────────────────────────────────────
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        const discordSdk = new DiscordSDK(clientId);
        const handshakeTimeoutMs = isMobile ? 45000 : 20000;
        const readyPromise = Promise.race([
          discordSdk.ready(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), handshakeTimeoutMs),
          ),
        ]);

        // Create the auth transaction in parallel with the handshake so
        // neither one blocks the other.
        const startPromise = fetch("/api/discord/auth/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "embedded",
            source: "activity",
            platform: isMobile ? "mobile" : "desktop",
            channelId,
            guildId,
            returnPath: channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2",
          }),
        });

        // Wait for both the handshake and the auth transaction to complete.
        const [startRes] = await Promise.all([startPromise, readyPromise]);
        if (cancelled) return;

        const startJson = (await startRes.json().catch(() => ({}))) as any;
        const tx = startJson?.transaction as AuthTransaction | undefined;
        if (!startRes.ok || !tx?.id) throw new Error(startJson?.error ?? "Failed to start Discord auth.");

        setStage("embedded_ready");

        setStage("embedded_authorizing");
        const authz = await (discordSdk as any).commands.authorize({
          client_id: clientId,
          response_type: "code",
          prompt: "none",
          scope: ["identify"],
          state: tx.id,
        });
        const code = String(authz?.code ?? "");
        if (!code) throw new Error("Discord authorize did not return a code.");

        const completed = await completeTransaction(tx.id, code);
        if (cancelled) return;

        const accessToken = String(completed?.access_token ?? "");
        if (accessToken) {
          try {
            await (discordSdk as any).commands.authenticate({ access_token: accessToken });
          } catch {
            // ignore authenticate failures; the app session is already established server-side
          }
        }

        setStage("authenticated");
        await redirectIntoGame(completed?.transaction?.channelId ?? channelId);
      } catch (e: any) {
        if (cancelled) return;
        setStage("failed");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, oauthCodeFromQuery, transactionIdFromQuery, hasFrameId, isMobile, channelId, guildId, completeTransaction, redirectIntoGame, beginBrowserPairing, browserPairingTx?.id]);

  const progress = useMemo(() => {
    if (stage === "booting") return 10;
    if (stage === "embedded_ready") return 26;
    if (stage === "embedded_authorizing") return 46;
    if (stage === "session_creating") return 68;
    if (stage === "authenticated") return 86;
    if (stage === "redirecting") return 95;
    if (stage === "browser_pairing") return 44;
    return 100;
  }, [stage]);

  const stageLabel = useMemo(() => {
    if (stage === "booting") return "Connecting to Discord…";
    if (stage === "embedded_ready") return "Discord connected.";
    if (stage === "embedded_authorizing") return "Authorizing with Discord…";
    if (stage === "session_creating") return "Creating your game session…";
    if (stage === "authenticated") return "Authenticated.";
    if (stage === "redirecting") return "Loading table…";
    if (stage === "browser_pairing") return "Browser pairing ready.";
    if (stage === "linked") return "Discord sign-in completed.";
    if (stage === "fallback_available") return "Choose a fallback option.";
    return "Discord sign-in failed.";
  }, [stage]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "radial-gradient(1200px 600px at 50% -10%, rgba(168,85,247,.22), transparent 60%), linear-gradient(#05070f, #070a14)",
        padding: "40px 16px",
        color: "white",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <style>{`
        @keyframes lgc-spin { to { transform: rotate(360deg); } }
        .lgc-card {
          width: 100%;
          max-width: 620px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          box-shadow: 0 22px 60px rgba(0,0,0,.45);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          padding: 24px;
        }
        .lgc-title { font-size: 24px; font-weight: 700; }
        .lgc-subtitle { margin-top: 8px; color: rgba(255,255,255,.72); font-size: 14px; line-height: 1.7; }
        .lgc-progress {
          margin-top: 20px;
          width: 100%;
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.1);
        }
        .lgc-progress > div {
          height: 100%;
          width: 0%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(56,189,248,.95), rgba(168,85,247,.95));
          transition: width .35s ease;
        }
        .lgc-stage {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255,255,255,.78);
          font-size: 14px;
        }
        .lgc-spinner {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,.18);
          border-top-color: rgba(52,211,153,.95);
          animation: lgc-spin 1s linear infinite;
        }
        .lgc-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .lgc-action {
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.9);
          border-radius: 14px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .lgc-action:hover { background: rgba(255,255,255,.1); }
        .lgc-link { color: rgba(165,180,252,.96); text-decoration: underline; text-underline-offset: 3px; }
        .lgc-tiny { color: rgba(255,255,255,.5); font-size: 11px; line-height: 1.7; }
        .lgc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div className="lgc-card">
          <div className="lgc-title">Discord blackjack</div>
          <div className="lgc-subtitle">{stageLabel}</div>

          <div className="lgc-progress" aria-hidden="true">
            <div style={{ width: `${progress}%` }} />
          </div>

          <div className="lgc-stage">
            {stage !== "fallback_available" && stage !== "linked" && stage !== "failed" ? <div className="lgc-spinner" /> : null}
            <span>{stage}</span>
          </div>

          {stage === "browser_pairing" && browserPairingTx ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                padding: "14px 16px",
                color: "rgba(255,255,255,.82)",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 700, color: "rgba(255,255,255,.96)" }}>Browser pairing code</div>
              <div className="lgc-mono" style={{ marginTop: 10, fontSize: 28, letterSpacing: "0.32em" }}>
                {browserPairingTx.pairingCode}
              </div>
              <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                Open <span className="lgc-mono">{mobileLinkUrl}</span> in your browser, enter this code, and finish Discord sign-in there.
                This Activity will continue automatically as soon as the browser step completes.
              </div>
              <div className="lgc-tiny" style={{ marginTop: 10 }}>
                Code expires in {Math.max(0, Math.ceil((browserPairingTx.expiresAt - Date.now()) / 60000))} min.
              </div>
            </div>
          ) : null}

          {stage === "fallback_available" || stage === "failed" ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                padding: "14px 16px",
                color: "rgba(255,255,255,.82)",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 700, color: "rgba(255,255,255,.96)" }}>Fallback options</div>
              <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                Embedded Discord sign-in did not complete cleanly. You can retry it, continue with a temporary username,
                or use browser pairing as a rescue path.
              </div>
              <div className="lgc-row">
                <button type="button" className="lgc-action" onClick={retryEmbeddedFlow}>
                  Retry Discord sign-in
                </button>
                <button type="button" className="lgc-action" onClick={startGuestMode}>
                  Play with temporary username
                </button>
                <button
                  type="button"
                  className="lgc-action"
                  onClick={async () => {
                    try {
                      await beginBrowserPairing();
                    } catch (e: any) {
                      setErr(String(e?.message ?? "Failed to start browser pairing."));
                    }
                  }}
                >
                  Use browser pairing
                </button>
              </div>
            </div>
          ) : null}

          {stage === "linked" ? (
            <div className="lgc-tiny" style={{ marginTop: 12 }}>
              Discord sign-in completed in the browser. Return to the Discord Activity and it should continue automatically.
            </div>
          ) : null}

          {err ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(244,63,94,.22)",
                background: "rgba(244,63,94,.12)",
                padding: "10px 12px",
                color: "rgba(255,228,230,.95)",
                fontSize: 14,
              }}
            >
              {err}
            </div>
          ) : null}

          {stage !== "redirecting" ? <div className="lgc-tiny" style={{ marginTop: 10 }}>Elapsed: {elapsed}s</div> : null}
        </div>
      </div>
    </div>
  );
}
