"use client";

import { useMemo, useState } from "react";

export default function DiscordMobileLinkPage() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const normalizedCode = useMemo(() => String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12), [code]);
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk-liquid-glass-casino.vercel.app/casino/blackjack/discord";

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
          disabled={!clientId || !normalizedCode || busy}
          className="mt-5 glass-soft rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500/15 disabled:opacity-40"
          onClick={async () => {
            if (!clientId || !normalizedCode) return;
            setBusy(true);
            setMsg(null);
            try {
              const statusRes = await fetch(`/api/discord/auth/status?code=${encodeURIComponent(normalizedCode)}`, { cache: "no-store" });
              const statusJson = (await statusRes.json().catch(() => ({}))) as any;
              if (!statusRes.ok || !statusJson?.transaction?.id) throw new Error(statusJson?.error ?? "Pairing code not found");
              const txId = String(statusJson.transaction.id);
              const url = new URL("https://discord.com/oauth2/authorize");
              url.searchParams.set("client_id", clientId);
              url.searchParams.set("response_type", "code");
              url.searchParams.set("redirect_uri", redirectUri);
              url.searchParams.set("scope", "identify");
              url.searchParams.set("state", txId);
              window.location.href = url.toString();
            } catch (e: any) {
              setMsg(String(e?.message ?? "Failed to start Discord sign-in"));
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking code…" : "Continue with Discord"}
        </button>
        <div className="mt-4 text-xs leading-5 text-white/50">
          Use this only if the embedded Discord sign-in inside the Activity failed. After authorization completes here,
          your Discord Activity should pick up the session automatically.
        </div>
        {msg ? <div className="mt-4 text-sm text-rose-200">{msg}</div> : null}
      </div>
    </div>
  );
}
