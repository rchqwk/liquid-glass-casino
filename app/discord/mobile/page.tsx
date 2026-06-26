"use client";

import { useMemo, useState } from "react";

export default function DiscordMobileLinkPage() {
  const [code, setCode] = useState("");
  const normalizedCode = useMemo(() => String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12), [code]);
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_WEB_REDIRECT_URI ?? "https://rchqwk-liquid-glass-casino.vercel.app/discord/callback";

  const oauthUrl = useMemo(() => {
    if (!clientId || !normalizedCode) return null;
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", `mobile:${normalizedCode}`);
    return url.toString();
  }, [clientId, normalizedCode, redirectUri]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center justify-center px-4 py-10">
      <div className="glass glass-shine w-full rounded-3xl p-6">
        <div className="text-xl font-semibold text-white">Link mobile Discord Activity</div>
        <div className="mt-2 text-sm leading-6 text-white/70">
          Enter the code shown inside the Discord blackjack Activity, then continue with Discord in this browser.
        </div>
        <label className="mt-5 block text-xs font-medium uppercase tracking-[0.18em] text-white/55">Pairing code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-white outline-none focus:border-white/20"
        />
        <button
          type="button"
          disabled={!oauthUrl}
          className="mt-5 glass-soft rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500/15 disabled:opacity-40"
          onClick={() => {
            if (!oauthUrl) return;
            window.location.href = oauthUrl;
          }}
        >
          Continue with Discord
        </button>
        <div className="mt-4 text-xs leading-5 text-white/50">
          After authorization completes here, your Discord Activity should pick up the session automatically.
        </div>
      </div>
    </div>
  );
}

