"use client";

import { useEffect, useMemo, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";

// ──────────────────────────────────────────────────────
// MODULE-LEVEL SDK BOOT
//
// This runs when the JS bundle evaluates — BEFORE any
// React code. It flushes any READY captured by the inline
// <head> script and creates the SDK so ready() receives
// the re-dispatched READY immediately.
// ──────────────────────────────────────────────────────
const MODULE_CLIENT_ID =
  (typeof process !== "undefined" && (process.env as any)?.NEXT_PUBLIC_DISCORD_CLIENT_ID) ||
  (typeof process !== "undefined" && (process.env as any)?.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK) ||
  "";

let _sdk: DiscordSDK | null = null;
let _ready: Promise<void> | null = null;

if (typeof window !== "undefined" && MODULE_CLIENT_ID && !(window as any).__DISCORD_SDK) {
  try {
    _sdk = new DiscordSDK(MODULE_CLIENT_ID);
    _ready = _sdk.ready();
    (window as any).__DISCORD_SDK = _sdk;
    (window as any).__DISCORD_READY = _ready;
  } catch {
    // SDK init failed
  }
  // Flush AFTER ready() registers the listener, so the re-dispatched
  // READY is caught rather than lost.
  try {
    (window as any).__discordReadyFlush?.();
  } catch {
    // inline script not present
  }
}

type Stage =
  | "booting"
  | "embedded_authorizing"
  | "session_creating"
  | "authenticated"
  | "fallback_available"
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

export default function DiscordMobileAuth() {
  const [stage, setStage] = useState<Stage>("booting");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const clientId = MODULE_CLIENT_ID;

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return window.location.origin; } catch { return ""; }
  }, []);

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const hasFrameId = useMemo(() => !!qs?.get("frame_id"), [qs]);
  const channelId = useMemo(() => qs?.get("channel_id") ?? null, [qs]);
  const oauthCode = useMemo(() => qs?.get("code") ?? null, [qs]);
  const oauthState = useMemo(() => qs?.get("state") ?? null, [qs]);
  const txIdFromOauth = useMemo(() => {
    const raw = String(oauthState ?? "").trim();
    return /^[a-f0-9]{48}$/i.test(raw) ? raw : null;
  }, [oauthState]);

  const redirectUri = useMemo(() => {
    if (!origin) return "https://rchqwk.com";
    if (txIdFromOauth) return `${origin}/casino/blackjack/discord`;
    return origin;
  }, [origin, txIdFromOauth]);

  const isMobile = useMemo(() => {
    try {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent ?? "");
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ──────────────────────────────────────────────────
  // MODE 1: OAuth callback — exchange code for session
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!oauthCode || !txIdFromOauth) return;
    let cancelled = false;
    (async () => {
      setStage("session_creating");
      try {
        const res = await fetch("/api/discord/auth/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactionId: txIdFromOauth, code: oauthCode, redirectUri }),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(data?.error ?? "Discord login failed.");
        if (data?.session_token) {
          try { localStorage.setItem("lgc.session", String(data.session_token)); } catch {}
        }
        if (cancelled) return;
        setStage("authenticated");
        const tx = data?.transaction as AuthTransaction | undefined;
        const targetChannel = tx?.channelId ?? channelId;
        window.location.replace(
          targetChannel ? `/casino/blackjack-v2/${encodeURIComponent(targetChannel)}` : "/casino/blackjack-v2"
        );
      } catch (e: any) {
        if (cancelled) return;
        setStage("failed");
        setErr(String(e?.message ?? "Failed to complete Discord sign-in."));
      }
    })();
    return () => { cancelled = true; };
  }, [oauthCode, txIdFromOauth, channelId, redirectUri]);

  // ──────────────────────────────────────────────────
  // MODE 2: Initial Activity load — SDK handshake + auth
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasFrameId) return;
    if (oauthCode) return; // handled by Mode 1
    let cancelled = false;

    (async () => {
      try {
        setStage("booting");

        // Use the module-level SDK (READY was already flushed at module eval time)
        const sdk: DiscordSDK | undefined = (window as any).__DISCORD_SDK;
        const readyPromise: Promise<void> | undefined = (window as any).__DISCORD_READY;
        if (!sdk || !readyPromise) throw new Error("SDK failed to initialize.");

        // Wait for handshake with timeout
        const timeout = isMobile ? 10000 : 5000;
        await Promise.race([
          readyPromise,
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("handshake timeout")), timeout)
          ),
        ]);

        if (cancelled) return;

        // Create auth transaction
        setStage("embedded_authorizing");
        const startRes = await fetch("/api/discord/auth/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "embedded",
            source: "activity",
            platform: isMobile ? "mobile" : "desktop",
            channelId,
            returnPath: channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2",
          }),
        });
        const startJson = (await startRes.json().catch(() => ({}))) as any;
        const tx = startJson?.transaction as AuthTransaction | undefined;
        if (!startRes.ok || !tx?.id) throw new Error(startJson?.error ?? "Failed to start Discord auth.");

        // Authorize via SDK
        const authz = await (sdk as any).commands.authorize({
          client_id: clientId,
          response_type: "code",
          prompt: "none",
          scope: ["identify"],
          state: tx.id,
        });
        const code = String(authz?.code ?? "");
        if (!code) throw new Error("Discord authorize did not return a code.");

        // Exchange code for session
        setStage("session_creating");
        const completed = await (async () => {
          const res = await fetch("/api/discord/auth/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ transactionId: tx.id, code, redirectUri }),
          });
          const d = (await res.json().catch(() => ({}))) as any;
          if (!res.ok) throw new Error(d?.error ?? "Discord login failed.");
          if (d?.session_token) {
            try { localStorage.setItem("lgc.session", String(d.session_token)); } catch {}
          }
          return d;
        })();

        const accessToken = String(completed?.access_token ?? "");
        if (accessToken) {
          try { await (sdk as any).commands.authenticate({ access_token: accessToken }); } catch {}
        }

        if (cancelled) return;
        setStage("authenticated");
        window.location.replace(
          channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2"
        );
      } catch (e: any) {
        if (cancelled) return;
        setStage("failed");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();

    return () => { cancelled = true; };
  }, [hasFrameId, oauthCode, clientId, channelId, redirectUri, isMobile]);

  // ──────────────────────────────────────────────────
  // MODE 3: Neither frame_id nor OAuth — show fallback
  // ──────────────────────────────────────────────────
  useEffect(() => {
    if (hasFrameId || oauthCode) return;
    setStage("fallback_available");
  }, [hasFrameId, oauthCode]);

  const progress = stage === "booting" ? 10
    : stage === "embedded_authorizing" ? 36
    : stage === "session_creating" ? 62
    : stage === "authenticated" ? 88
    : 100;

  const stageLabel = stage === "booting" ? "Connecting to Discord…"
    : stage === "embedded_authorizing" ? "Authorizing with Discord…"
    : stage === "session_creating" ? "Creating your game session…"
    : stage === "authenticated" ? "Authenticated."
    : "Discord sign-in failed.";

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
        .lgc-tiny { color: rgba(255,255,255,.5); font-size: 11px; line-height: 1.7; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div className="lgc-card">
          <div className="lgc-title">Discord blackjack</div>
          <div className="lgc-subtitle">{stageLabel}</div>

          <div className="lgc-progress" aria-hidden="true">
            <div style={{ width: `${progress}%` }} />
          </div>

          <div className="lgc-stage">
            {stage !== "fallback_available" && stage !== "failed" ? <div className="lgc-spinner" /> : null}
            <span>{stage}</span>
          </div>

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
              <div style={{ fontWeight: 700, color: "rgba(255,255,255,.96)" }}>Could not start Discord sign-in</div>
              <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                {err || "Discord Activity parameters were not detected. Make sure you're opening this from within the Discord app."}
              </div>
              <div className="lgc-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="lgc-action"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="lgc-action"
                  onClick={() => {
                    try { sessionStorage.setItem("lgc.discord.disableOauthSession", "1"); } catch {}
                    window.location.replace(channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2");
                  }}
                >
                  Play with temporary username
                </button>
              </div>
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

          {stage !== "authenticated" ? <div className="lgc-tiny" style={{ marginTop: 10 }}>Elapsed: {elapsed}s</div> : null}
        </div>
      </div>
    </div>
  );
}
