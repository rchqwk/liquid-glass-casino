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
  const [isReady, setIsReady] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk-liquid-glass-casino.vercel.app/casino/blackjack/discord";

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  useEffect(() => {
    console.log("[Discord Entry] Component mounted");
    console.log("[Discord Entry] Client ID present:", !!clientId);
    console.log("[Discord Entry] Redirect URI:", redirectUri);
    setIsReady(true);
  }, [clientId, redirectUri]);

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

  // Mobile pairing code: only create when we're on mobile AND the SDK path has been exhausted
  // (i.e. stage is "awaiting_oauth" meaning the SDK either wasn't available or timed out).
  useEffect(() => {
    if (!isMobile) return;
    if (oauthCodeFromQuery) return;
    if (mobileAuth) return;
    if (stage !== "awaiting_oauth" && stage !== "error") return;
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
  }, [isMobile, oauthCodeFromQuery, mobileAuth, channelId, stage]);

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
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      try {
        console.log("[Discord Entry] Starting auth flow");
        setErr(null);
        if (!clientId) {
          console.error("[Discord Entry] Missing client ID");
          throw new Error("Missing NEXT_PUBLIC_DISCORD_CLIENT_ID");
        }

        console.log("[Discord Entry] hasFrameId:", hasFrameId, "oauthCodeFromQuery:", !!oauthCodeFromQuery, "channelId:", channelId);

        if (oauthCodeFromQuery) {
          console.log("[Discord Entry] PATH 1: Processing OAuth callback");
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

          // If this was a mobile pairing code completion, just mark it done.
          // The Activity (which is polling) will pick up the session.
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

        if (hasFrameId) {
          console.log("[Discord Entry] PATH 2: Attempting Embedded App SDK");
          try {
            let DiscordSDK: any;
            try {
              console.log("[Discord Entry] Importing @discord/embedded-app-sdk");
              const sdkModule = await import("@discord/embedded-app-sdk");
              DiscordSDK = sdkModule.DiscordSDK;
              console.log("[Discord Entry] SDK imported successfully");
            } catch (importErr: any) {
              console.error("[Discord Entry] SDK import failed:", importErr);
              throw new Error(`Failed to load Discord SDK: ${importErr?.message ?? "Unknown error"}`);
            }
            if (!DiscordSDK) {
              throw new Error("DiscordSDK not found in module");
            }
            console.log("[Discord Entry] Creating DiscordSDK instance");
            const discordSdk = new DiscordSDK(clientId);
            console.log("[Discord Entry] Waiting for SDK ready");
            await Promise.race([
              discordSdk.ready(),
              new Promise((_, reject) => window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), isMobile ? 10000 : 20000)),
            ]);
            console.log("[Discord Entry] SDK ready");

            const sdkChannelId = (discordSdk as any).channelId as string | undefined;
            const effectiveChannelId = sdkChannelId ?? channelId;
            console.log("[Discord Entry] SDK channelId:", sdkChannelId, "effectiveChannelId:", effectiveChannelId);
            if (!effectiveChannelId) {
              console.error("[Discord Entry] Missing channel ID");
              throw new Error("Missing channel id (must be launched from a voice call Activity).");
            }

            console.log("[Discord Entry] Calling authorize");
            setStage("authorizing");
            const authz = await (discordSdk as any).commands.authorize({
              client_id: clientId,
              response_type: "code",
              prompt: "none",
              scope: ["identify", "rpc.activities.write"],
            });
            console.log("[Discord Entry] Authorize returned");
            const sdkCode = String(authz?.code ?? "");
            if (!sdkCode) {
              console.error("[Discord Entry] No code from authorize");
              throw new Error("Discord authorize did not return a code.");
            }
            console.log("[Discord Entry] Got auth code");

            console.log("[Discord Entry] Calling login API");
            setStage("logging_in");
            const loginRes = await fetch("/api/discord/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: sdkCode, redirectUri }),
            });
            const loginJson = (await loginRes.json().catch(() => ({}))) as any;
            console.log("[Discord Entry] Login API response:", loginRes.status, loginJson);
            if (!loginRes.ok) {
              console.error("[Discord Entry] Login failed:", loginJson?.error);
              throw new Error(loginJson?.error ?? "Discord login failed.");
            }
            if (loginJson?.session_token) {
              try {
                localStorage.setItem("lgc.session", String(loginJson.session_token));
              } catch {
                // ignore
              }
            }

            const accessToken = String(loginJson?.access_token ?? "");
            if (accessToken) {
              console.log("[Discord Entry] Authenticating with access token");
              await (discordSdk as any).commands.authenticate({ access_token: accessToken });
              console.log("[Discord Entry] Authenticated");
            }

            console.log("[Discord Entry] Ensuring table for channel:", effectiveChannelId);
            setStage("ensuring_table");
            const ensureRes = await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/ensure`, { method: "POST" });
            const ensureJson = (await ensureRes.json().catch(() => ({}))) as any;
            console.log("[Discord Entry] Ensure table response:", ensureRes.status, ensureJson);
            if (!ensureRes.ok) {
              console.error("[Discord Entry] Table ensure failed:", ensureJson?.error);
              throw new Error(ensureJson?.error ?? "Failed to create/join table.");
            }

            console.log("[Discord Entry] Joining table");
            await fetch(`/api/blackjack/tables/${encodeURIComponent(effectiveChannelId)}/join`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ spectate: false }),
            });
            console.log("[Discord Entry] Joined table");

            if (cancelled) return;
            setStage("redirecting");
            router.replace(`/casino/blackjack-v2/${encodeURIComponent(effectiveChannelId)}`);
            return;
          } catch (sdkErr: any) {
            const msg = String(sdkErr?.message ?? "");
            console.error("[Discord Entry] SDK error:", msg, sdkErr);
            if (cancelled) return;
            if (!msg.includes("handshake timed out") && !msg.includes("frame_id")) {
              console.error("[Discord Entry] Non-timeout SDK error, rethrowing");
              throw sdkErr;
            }
            console.log("[Discord Entry] SDK timeout, falling through to fallback");
          }
        }

        console.log("[Discord Entry] PATH 3: Fallback path - isMobile:", isMobile);
        if (isMobile) {
          console.log("[Discord Entry] Mobile - setting awaiting_oauth for pairing code");
          setStage("awaiting_oauth");
        } else {
          console.log("[Discord Entry] Desktop - awaiting_oauth with auto redirect");
          setStage("awaiting_oauth");
          if (oauthAuthorizeUrl) {
            try {
              const key = "lgc.discord.oauthAutoRedirected";
              if (sessionStorage.getItem(key) !== "1") {
                sessionStorage.setItem(key, "1");
                const t = window.setTimeout(() => {
                  window.location.href = oauthAuthorizeUrl;
                }, 700);
                // Clean up timeout on unmount
                return () => window.clearTimeout(t);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Discord Entry] Fatal error in auth flow:", e);
        setStage("error");
        setErr(String(e?.message ?? "Failed to start Discord blackjack."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

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

  // OAuth auto-redirect for desktop: if we land on "awaiting_oauth" without a code, redirect automatically.
  // Mobile is deliberately excluded because browser OAuth redirects lose Activity context on mobile;
  // the pairing-code flow handles mobile separately.
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
      }, 700);
      return () => window.clearTimeout(t);
    } catch {
      // ignore
    }
  }, [stage, oauthCodeFromQuery, oauthAuthorizeUrl, isMobile]);

  // Desktop-only fallback: if the page loads without embedded params and no OAuth code,
  // auto-redirect to OAuth. Mobile is excluded because this path doesn't work in Activities.
  useEffect(() => {
    if (isMobile) return;
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
                  Open <span className="font-mono text-neon-magenta">{mobileLinkUrl}</span> in your browser, enter the code above, and complete Discord sign-in.
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
