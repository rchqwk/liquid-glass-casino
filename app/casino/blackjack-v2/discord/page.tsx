"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "init" | "awaiting_oauth" | "authorizing" | "logging_in" | "ensuring_table" | "redirecting" | "linked" | "error";

export default function DiscordBlackjackV2EntryPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("init");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mobileAuth, setMobileAuth] = useState<null | { token: string; code: string; channelId?: string | null; expiresAt: number }>(null);
  const [isReady, setIsReady] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "1512024820194349157";
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk.com/casino/blackjack-v2/discord";

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const frameId = qs?.get("frame_id") ?? null;
  const channelId = qs?.get("channel_id") ?? null;
  const guildId = qs?.get("guild_id") ?? null;
  const userId = qs?.get("user_id") ?? null;
  const oauthCodeFromQuery = qs?.get("code") ?? null;
  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
  const hasFrameId = Boolean(frameId);

  const mobileLinkUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/casino/mobile-link`;
  }, []);

  const stageLabel = useMemo(() => {
    switch (stage) {
      case "init":
        return "Initializing…";
      case "awaiting_oauth":
        return isMobile ? "Waiting for mobile sign-in" : "Waiting for Discord authorization";
      case "authorizing":
        return "Authorizing with Discord…";
      case "logging_in":
        return "Signing in…";
      case "ensuring_table":
        return "Setting up table…";
      case "redirecting":
        return "Joining game…";
      case "linked":
        return "Sign-in complete!";
      case "error":
        return "Error";
      default:
        return "";
    }
  }, [stage, isMobile]);

  const progress = useMemo(() => {
    const weights: Record<Stage, number> = {
      init: 5,
      awaiting_oauth: 20,
      authorizing: 35,
      logging_in: 55,
      ensuring_table: 80,
      redirecting: 95,
      linked: 100,
      error: 0,
    };
    return weights[stage];
  }, [stage]);

  const oauthAuthorizeUrl = useMemo(() => {
    if (!clientId) return null;
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("prompt", "none");
    return url.toString();
  }, [clientId, redirectUri]);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log("[Discord V2 Entry] Component mounted");
    console.log("[Discord V2 Entry] Client ID:", clientId);
    console.log("[Discord V2 Entry] Redirect URI:", redirectUri);
    console.log("[Discord V2 Entry] frame_id:", frameId, "channel_id:", channelId);
    setIsReady(true);
  }, [clientId, redirectUri, frameId, channelId]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    (async () => {
      try {
        console.log("[Discord V2 Entry] Starting auth flow");
        setErr(null);

        if (oauthCodeFromQuery) {
          console.log("[Discord V2 Entry] Processing OAuth callback");
          setStage("logging_in");
          const loginRes = await fetch("/api/discord/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: oauthCodeFromQuery, redirectUri }),
          });
          const loginJson = (await loginRes.json().catch(() => ({}))) as any;
          if (!loginRes.ok) throw new Error(loginJson?.error ?? "Login failed");
          console.log("[Discord V2 Entry] Login successful");
          setStage("linked");
          return;
        }

        if (hasFrameId) {
          console.log("[Discord V2 Entry] Attempting Embedded App SDK");
          try {
            const { DiscordSDK } = await import("@discord/embedded-app-sdk");
            console.log("[Discord V2 Entry] SDK imported");
            const discordSdk = new DiscordSDK(clientId);
            console.log("[Discord V2 Entry] Waiting for SDK ready");
            await Promise.race([
              discordSdk.ready(),
              new Promise((_, reject) => window.setTimeout(() => reject(new Error("SDK handshake timeout")), 15000)),
            ]);
            console.log("[Discord V2 Entry] SDK ready");

            const sdkChannelId = (discordSdk as any).channelId as string | undefined;
            const effectiveChannelId = sdkChannelId ?? channelId;
            if (!effectiveChannelId) throw new Error("Missing channel ID");

            console.log("[Discord V2 Entry] Authorizing");
            setStage("authorizing");
            const authz = await (discordSdk as any).commands.authorize({
              client_id: clientId,
              response_type: "code",
              prompt: "none",
              scope: ["identify", "rpc.activities.write"],
            });
            const sdkCode = String(authz?.code ?? "");
            if (!sdkCode) throw new Error("No auth code returned");

            console.log("[Discord V2 Entry] Logging in");
            setStage("logging_in");
            const loginRes = await fetch("/api/discord/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: sdkCode, redirectUri }),
            });
            const loginJson = (await loginRes.json().catch(() => ({}))) as any;
            if (!loginRes.ok) throw new Error(loginJson?.error ?? "Login failed");

            const accessToken = String(loginJson?.access_token ?? "");
            if (accessToken) {
              await (discordSdk as any).commands.authenticate({ access_token: accessToken });
            }

            console.log("[Discord V2 Entry] Ensuring table");
            setStage("ensuring_table");
            await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/ensure`, { method: "POST" });
            await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/join`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ spectate: false }),
            });

            console.log("[Discord V2 Entry] Redirecting to table");
            setStage("redirecting");
            router.push(`/casino/blackjack-v2/${effectiveChannelId}`);
          } catch (sdkErr: any) {
            console.warn("[Discord V2 Entry] SDK error:", sdkErr);
          }
        }

        console.log("[Discord V2 Entry] Falling through to OAuth flow");
        setStage("awaiting_oauth");
        if (!isMobile && oauthAuthorizeUrl) {
          window.location.href = oauthAuthorizeUrl;
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Discord V2 Entry] Fatal error:", e);
        setStage("error");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady]);

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
      `}</style>

      <div className="nn-card nn-fade-in p-6 text-center" style={{ maxWidth: 480 }}>
        {!isReady ? (
          <div>
            <div className="nn-spinner mx-auto" />
            <div className="mt-4 text-sm text-white/70">Initializing…</div>
          </div>
        ) : (
          <>
            <div className="text-lg font-bold text-white">Launching Discord Blackjack…</div>
            <div className="mt-2 text-sm text-white/70">{stageLabel}</div>

            <div className="mt-4">
              <div className="nn-badge nn-badge-cyan text-xs">
                {progress}% · <span className="font-mono">{stage}</span>
              </div>
            </div>

            {err ? (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
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
                  Launch this as a Discord Activity from a voice channel: <span className="font-mono text-neon-cyan">Rocket → your app → Start</span>
                </div>
              </div>
            ) : null}

            {isMobile && stage === "awaiting_oauth" && mobileAuth ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                <div className="font-semibold text-white">Mobile pairing code</div>
                <div className="mt-3 font-mono text-2xl tracking-widest text-neon-cyan">{mobileAuth.code}</div>
                <div className="mt-3 text-xs text-white/60">
                  Open <span className="font-mono text-neon-magenta">{mobileLinkUrl}</span> in your browser, enter the code above.
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
