"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "init" | "authorizing" | "logging_in" | "ensuring_table" | "redirecting" | "error";

export default function DiscordBlackjackEntryPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("init");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

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

  // If we initiated OAuth ourselves, we store channel id in `state`.
  const channelId = channelIdFromQuery ?? oauthStateFromQuery;

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        if (!clientId) throw new Error("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID");

        // If Discord didn't provide the Embedded App params, don't attempt to load the SDK
        // (it will throw: "frame_id query param is not defined"). Show the OAuth fallback.
        if (!hasFrameId && !oauthCodeFromQuery) {
          // Stay in init so the page shows the fallback authorize link after a few seconds.
          return;
        }

        // Fallback path: if we already have an OAuth code in the URL, we can complete login
        // without waiting for the Embedded SDK handshake.
        if (oauthCodeFromQuery) {
          if (!channelId) throw new Error("Missing channel id (channel_id or state). Re-open from the voice call.");
          setStage("logging_in");
          const loginRes = await fetch("/api/discord/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: oauthCodeFromQuery, redirectUri }),
          });
          const loginJson = (await loginRes.json().catch(() => ({}))) as any;
          if (!loginRes.ok) throw new Error(loginJson?.error ?? "Discord login failed.");

          setStage("ensuring_table");
          const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/ensure`, { method: "POST" });
          const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
          if (!ensureRes.ok) throw new Error(ensureJson?.error ?? "Failed to create/join table.");

          await fetch(`/api/blackjack/tables/${encodeURIComponent(channelId)}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ spectate: false }),
          });

          if (cancelled) return;
          setStage("redirecting");
          router.replace(`/casino/blackjack/${encodeURIComponent(channelId)}`);
          return;
        }

        // Dynamic import so local dev / non-discord environments don't crash bundling.
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        // eslint-disable-next-line new-cap
        const discordSdk = new DiscordSDK(clientId);
        // In some Discord contexts the handshake can hang; show feedback + allow OAuth fallback.
        await Promise.race([
          discordSdk.ready(),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), 9000)),
        ]);

        const sdkChannelId = (discordSdk as any).channelId as string | undefined;
        const effectiveChannelId = sdkChannelId ?? channelId;
        if (!effectiveChannelId) throw new Error("Missing channel id (must be launched from a voice call Activity).");

        setStage("authorizing");
        const authz = await (discordSdk as any).commands.authorize({
          client_id: clientId,
          response_type: "code",
          prompt: "none",
          scope: ["identify"],
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
        router.replace(`/casino/blackjack/${encodeURIComponent(effectiveChannelId)}`);
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
    if (stage === "authorizing") return 30;
    if (stage === "logging_in") return 55;
    if (stage === "ensuring_table") return 78;
    if (stage === "redirecting") return 95;
    if (stage === "error") return 100;
    return 10;
  }, [stage]);

  const stageLabel = useMemo(() => {
    if (stage === "init") return "Connecting to Discord…";
    if (stage === "authorizing") return "Authorizing…";
    if (stage === "logging_in") return "Signing you in…";
    if (stage === "ensuring_table") return "Creating / joining table…";
    if (stage === "redirecting") return "Loading table…";
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
    url.searchParams.set("scope", "identify");
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }, [clientId, redirectUri, channelId]);

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

          {stage === "init" && elapsed >= 2 && oauthAuthorizeUrl ? (
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
              If this stays stuck, click{" "}
              <a className="lgc-link" href={oauthAuthorizeUrl}>
                Authorize with Discord
              </a>{" "}
              to continue.
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
