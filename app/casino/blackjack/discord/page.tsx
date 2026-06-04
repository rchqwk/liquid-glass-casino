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
    <div className="min-h-[100dvh] w-full bg-slate-950/95 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <div className="glass glass-shine w-full max-w-[620px] rounded-3xl border border-white/10 p-6 text-white">
        <div className="text-base font-semibold text-white">Launching Discord Blackjack…</div>
        <div className="mt-2 text-sm text-white/70">{stageLabel}</div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-fuchsia-400 transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
            <div className="text-sm text-white/70">Loading… <span className="font-mono text-white/60">{elapsed}s</span></div>
          </div>
          <div className="mt-2 text-[11px] text-white/60">
            {progress}% • <span className="font-mono">{stage}</span>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        {stage === "init" && elapsed >= 2 && oauthAuthorizeUrl ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            If this stays stuck, click{" "}
            <a className="underline decoration-white/30 underline-offset-4 hover:text-white" href={oauthAuthorizeUrl}>
              Authorize with Discord
            </a>{" "}
            to continue.
          </div>
        ) : null}

        <div className="mt-4 text-[11px] text-white/50">
          Tip: launch this as a Discord Activity from within a voice call. (For local testing you can pass{" "}
          <span className="font-mono text-white/70">?channel_id=...</span>.)
        </div>
      </div>
      </div>
    </div>
  );
}
