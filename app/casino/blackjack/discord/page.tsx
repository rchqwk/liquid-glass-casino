"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "init" | "awaiting_oauth" | "authorizing" | "logging_in" | "ensuring_table" | "redirecting" | "linked" | "error";

export default function DiscordBlackjackEntryPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("init");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mobileAuth, setMobileAuth] = useState<null | { token: string; code: string; channelId?: string | null; expiresAt: number }>(null);

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk-liquid-glass-casino.vercel.app/casino/blackjack/discord";

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const hasFrameId = useMemo(() => !!qs?.get("frame_id"), [qs]);
  const channelIdFromQuery = useMemo(() => qs?.get("channel_id") ?? null, [qs]);
  const oauthCodeFromQuery = useMemo(() => qs?.get("code") ?? null, [qs]);
  const oauthStateFromQuery = useMemo(() => qs?.get("state") ?? null, [qs]);
  const mobileAuthCode = useMemo(() => {
    const raw = String(oauthStateFromQuery ?? "");
    return raw.startsWith("mobile:") ? raw.slice("mobile:".length).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) : null;
  }, [oauthStateFromQuery]);

  // If we initiated OAuth ourselves, we store channel id in `state`.
  const channelId = channelIdFromQuery ?? (mobileAuthCode ? null : oauthStateFromQuery);
  const isMobile = useMemo(() => {
    try {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent ?? "";
      return /iPhone|iPad|iPod|Android/i.test(ua);
    } catch {
      return false;
    }
  }, []);
  const isIOS = useMemo(() => {
    try {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent ?? "";
      return /iPhone|iPad|iPod/i.test(ua);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (oauthCodeFromQuery) return;
    if (mobileAuth) return;
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
        setMobileAuth({
          token: String(data.token),
          code: String(data.code),
          channelId: (data.channelId ?? channelId ?? null) as string | null,
          expiresAt: Number(data.expiresAt ?? 0) || Date.now() + 15 * 60 * 1000,
        });
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErr(String(e?.message ?? "Failed to initialize mobile Discord sign-in."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMobile, oauthCodeFromQuery, mobileAuth, channelId]);

  useEffect(() => {
    if (!isMobile) return;
    if (!mobileAuth?.token) return;
    if (oauthCodeFromQuery) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/discord/mobile-auth?token=${encodeURIComponent(mobileAuth.token)}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) return;
        if (cancelled) return;
        if (data?.status === "completed" && data?.sessionToken) {
          try {
            localStorage.setItem("lgc.session", String(data.sessionToken));
          } catch {
            // ignore
          }
          setStage("redirecting");
          const nextChannelId = String(data?.channelId ?? mobileAuth.channelId ?? "").trim();
          router.replace(nextChannelId ? `/casino/blackjack-v2/${encodeURIComponent(nextChannelId)}` : "/casino/blackjack-v2");
        }
      } catch {
        // ignore transient poll failures
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isMobile, mobileAuth, oauthCodeFromQuery, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        if (!clientId) throw new Error("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID");

        // If Discord didn't provide the Embedded App params, don't attempt to load the SDK
        // (it will throw: "frame_id query param is not defined"). Show the OAuth fallback.
        if (!hasFrameId && !oauthCodeFromQuery) {
          setStage(isMobile ? "awaiting_oauth" : "init");
          return;
        }

        // Fallback path: if we already have an OAuth code in the URL, we can complete login
        // without waiting for the Embedded SDK handshake.
        if (oauthCodeFromQuery) {
          setStage("logging_in");
          const loginRes = await fetch("/api/discord/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: oauthCodeFromQuery, redirectUri, mobileAuthCode }),
          });
          const loginJson = (await loginRes.json().catch(() => ({}))) as any;
          if (!loginRes.ok) throw new Error(loginJson?.error ?? "Discord login failed.");
          if (loginJson?.session_token) {
            try {
              localStorage.setItem("lgc.session", String(loginJson.session_token));
            } catch {
              // ignore
            }
          }

          if (mobileAuthCode) {
            setStage("linked");
            return;
          }

          if (channelId) {
            setStage("ensuring_table");
            const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/ensure`, { method: "POST" });
            const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
            if (!ensureRes.ok) throw new Error(ensureJson?.error ?? "Failed to create/join table.");

            await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/join`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ spectate: false }),
            });
          }

          if (cancelled) return;
          setStage("redirecting");
          router.replace(channelId ? `/casino/blackjack-v2/${encodeURIComponent(channelId)}` : "/casino/blackjack-v2");
          return;
        }

        // On mobile Discord, use a simpler OAuth-first flow instead of trying the embedded handshake.
        if (isMobile && !oauthCodeFromQuery) {
          setStage("awaiting_oauth");
          return;
        }

        // Dynamic import so local dev / non-discord environments don't crash bundling.
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        // eslint-disable-next-line new-cap
        const discordSdk = new DiscordSDK(clientId);
        // In some Discord contexts the handshake can hang; show feedback + allow OAuth fallback.
        await Promise.race([
          discordSdk.ready(),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), 20000)),
        ]);

        const sdkChannelId = (discordSdk as any).channelId as string | undefined;
        const effectiveChannelId = sdkChannelId ?? channelId;
        if (!effectiveChannelId) throw new Error("Missing channel id (must be launched from a voice call Activity).");

        setStage("authorizing");
        const authz = await (discordSdk as any).commands.authorize({
          client_id: clientId,
          response_type: "code",
          prompt: "none",
          scope: ["identify", "rpc.activities.write"],
        });
        const code = String(authz?.code ?? "");
        if (!code) throw new Error("Discord authorize did not return a code.");

        setStage("logging_in");
        const loginRes = await fetch("/api/discord/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const loginJson = (await loginRes.json().catch(() => ({}))) as any;
        if (!loginRes.ok) throw new Error(loginJson?.error ?? "Discord login failed.");
        if (loginJson?.session_token) {
          try {
            localStorage.setItem("lgc.session", String(loginJson.session_token));
          } catch {
            // ignore
          }
        }

        const accessToken = String(loginJson?.access_token ?? "");
        if (accessToken) {
          await (discordSdk as any).commands.authenticate({ access_token: accessToken });
        }

        setStage("ensuring_table");
        const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/ensure`, { method: "POST" });
        const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
        if (!ensureRes.ok) throw new Error(ensureJson?.error ?? "Failed to create/join table.");

        // Now join the table and land on the standard table UI.
        await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: false }),
        });

        if (cancelled) return;
        setStage("redirecting");
        router.replace(`/casino/blackjack-v2/${encodeURIComponent(effectiveChannelId)}`);
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (stage === "awaiting_oauth") return "Authorize with Discord to continue…";
    if (stage === "authorizing") return "Authorizing…";
    if (stage === "logging_in") return "Signing you in…";
    if (stage === "ensuring_table") return "Creating / joining table…";
    if (stage === "redirecting") return "Loading table…";
    if (stage === "linked") return "Discord sign-in completed.";
    return "Error";
  }, [stage]);

  const oauthAuthorizeUrl = useMemo(() => {
    if (!clientId) return null;
    // Use state=channelId so we can recover the table id after redirect.
    const state = channelId ?? "";
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify rpc.activities.write");
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }, [clientId, redirectUri, channelId]);

  // If we already know we need OAuth, jump there automatically once per page load.
  useEffect(() => {
    if (isMobile) return;
    if (oauthCodeFromQuery) return;
    if (!oauthAuthorizeUrl) return;
    if (stage !== "awaiting_oauth") return;
    try {
      const key = "lgc.discord.oauthAutoRedirected";
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      const t = window.setTimeout(() => {
        window.location.href = oauthAuthorizeUrl;
      }, isMobile ? 250 : 700);
      return () => window.clearTimeout(t);
    } catch {
      // ignore
    }
  }, [stage, oauthCodeFromQuery, oauthAuthorizeUrl, isMobile]);

  // If Discord opened the page without the embedded params, also fall back automatically.
  useEffect(() => {
    if (isIOS || isMobile) return;
    if (hasFrameId) return;
    if (oauthCodeFromQuery) return;
    if (!oauthAuthorizeUrl) return;
    try {
      const key = "lgc.discord.oauthAutoRedirected";
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      const t = window.setTimeout(() => {
        window.location.href = oauthAuthorizeUrl;
      }, 700);
      return () => window.clearTimeout(t);
    } catch {
      // ignore
    }
  }, [hasFrameId, oauthCodeFromQuery, oauthAuthorizeUrl, channelId]);

  const mobileLinkUrl = useMemo(() => {
    if (typeof window === "undefined") return "/discord/mobile";
    return `${window.location.origin}/discord/mobile`;
  }, []);

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
          padding: 20px;
        }
        .lgc-subtle { color: rgba(255,255,255,.70); }
        .lgc-tiny { color: rgba(255,255,255,.55); font-size: 12px; }
        .lgc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .lgc-progress-track { height: 8px; width: 100%; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); overflow: hidden; }
        .lgc-progress-bar { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #34d399, #d946ef); transition: width 500ms ease; }
        .lgc-spinner { width: 32px; height: 32px; border-radius: 999px; border: 2px solid rgba(255,255,255,.22); border-top-color: #6ee7b7; animation: lgc-spin 900ms linear infinite; }
        .lgc-link { color: rgba(255,255,255,.92); text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(255,255,255,.28); }
      `}</style>

      <div style={{ margin: "0 auto", maxWidth: 900, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="lgc-card">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Launching Discord Blackjack…</div>
          <div className="lgc-subtle" style={{ marginTop: 8, fontSize: 14 }}>
            {stageLabel}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="lgc-progress-track">
              <div className="lgc-progress-bar" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <div className="lgc-spinner" />
              <div className="lgc-subtle" style={{ fontSize: 14 }}>
                Loading… <span className="lgc-mono" style={{ color: "rgba(255,255,255,.60)" }}>{elapsed}s</span>
              </div>
            </div>
            <div className="lgc-tiny" style={{ marginTop: 8 }}>
              {progress}% • <span className="lgc-mono">{stage}</span>
            </div>
          </div>

          {err ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(251,113,133,.25)",
                background: "rgba(244,63,94,.12)",
                padding: "10px 12px",
                color: "rgba(255,228,230,.95)",
                fontSize: 14,
              }}
            >
              {err}
            </div>
          ) : null}

          {stage === "linked" ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(52,211,153,.25)",
                background: "rgba(16,185,129,.12)",
                padding: "10px 12px",
                color: "rgba(220,252,231,.96)",
                fontSize: 14,
              }}
            >
              Discord sign-in completed. Return to the Discord Activity and it should continue automatically.
            </div>
          ) : null}

          {err && String(err).toLowerCase().includes("handshake timed out") ? (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.08)",
                  padding: "10px 12px",
                  color: "rgba(255,255,255,.90)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => {
                  // Some iOS contexts get stuck during the Embedded SDK handshake.
                  // Allow a temporary fallback to the normal web sign-in flow (username).
                  try {
                    sessionStorage.removeItem("lgc.discord.embedded");
                    sessionStorage.removeItem("lgc.discord.qs");
                    sessionStorage.removeItem("lgc.discord.fallback.tried");
                    sessionStorage.removeItem("lgc.discord.oauthAutoRedirected");
                  } catch {
                    // ignore
                  }
                  try {
                    window.location.href = "/casino/blackjack";
                  } catch {
                    // ignore
                  }
                }}
              >
                Play with username (temporary)
              </button>
              <div className="lgc-tiny" style={{ alignSelf: "center" }}>
                This skips Discord auth so you can still play on iOS.
              </div>
            </div>
          ) : null}

          {isMobile && stage === "awaiting_oauth" && mobileAuth ? (
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
              <div style={{ fontWeight: 700, color: "rgba(255,255,255,.96)" }}>Mobile pairing code</div>
              <div className="lgc-mono" style={{ marginTop: 10, fontSize: 28, letterSpacing: "0.32em" }}>{mobileAuth.code}</div>
              <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                Open <span className="lgc-mono">{mobileLinkUrl}</span> in your phone browser, enter this code, and finish Discord sign-in there.
                This Activity will continue automatically as soon as the browser step completes.
              </div>
              <div className="lgc-tiny" style={{ marginTop: 10 }}>
                Code expires in {Math.max(0, Math.ceil((mobileAuth.expiresAt - Date.now()) / 60000))} min.
              </div>
              <button
                type="button"
                className="lgc-link"
                style={{ marginTop: 12, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
                onClick={() => {
                  try {
                    sessionStorage.setItem("lgc.discord.disableOauthSession", "1");
                  } catch {
                    // ignore
                  }
                  window.location.href = "/casino/blackjack-v2";
                }}
              >
                Play with temporary username instead
              </button>
            </div>
          ) : null}

          {!isMobile && (stage === "init" || stage === "awaiting_oauth") && (elapsed >= 2 || stage === "awaiting_oauth") && oauthAuthorizeUrl ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                padding: "10px 12px",
                color: "rgba(255,255,255,.78)",
                fontSize: 14,
              }}
            >
              {
                <>
                  If this stays stuck, click{" "}
                  <a className="lgc-link" href={oauthAuthorizeUrl}>
                    Authorize with Discord
                  </a>{" "}
                  to continue.
                </>
              }
            </div>
          ) : null}

          {!hasFrameId && !oauthCodeFromQuery ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                padding: "10px 12px",
                color: "rgba(255,255,255,.78)",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, color: "rgba(255,255,255,.92)" }}>Not embedded yet (missing frame_id)</div>
              <div style={{ marginTop: 6 }}>
                This usually means Discord is opening this as a normal web page instead of an Activity iframe. Start it from a
                voice channel: <span className="lgc-mono">Rocket (Activities) → your app → Start</span>.
              </div>
            </div>
          ) : null}

          <div className="lgc-tiny" style={{ marginTop: 16 }}>
            Tip: launch this as a Discord Activity from within a voice call. (For local testing you can pass{" "}
            <span className="lgc-mono">?channel_id=...</span>.)
          </div>
        </div>
      </div>
    </div>
  );
}
