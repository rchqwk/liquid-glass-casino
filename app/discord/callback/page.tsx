"use client";

import { useEffect, useMemo, useState } from "react";

export default function DiscordCallbackPage() {
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<"init" | "logging_in" | "redirecting" | "error">("init");

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const code = useMemo(() => qs?.get("code") ?? null, [qs]);
  const state = useMemo(() => qs?.get("state") ?? "/", [qs]);
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_WEB_REDIRECT_URI ??
    "https://rchqwk-liquid-glass-casino.vercel.app/discord/callback";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!code) throw new Error("Missing code");
        setStage("logging_in");
        const res = await fetch("/api/discord/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(data?.error ?? "Discord login failed");
        if (cancelled) return;
        setStage("redirecting");
        const next = String(state || "/");
        window.location.href = next.startsWith("/") ? next : "/";
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErr(String(e?.message ?? "Discord login failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, redirectUri, state]);

  return (
    <div className="mx-auto w-full max-w-xl p-6 sm:p-10">
      <div className="glass glass-shine rounded-3xl p-8">
        <div className="text-lg font-semibold text-white">Signing in with Discord…</div>
        <div className="mt-2 text-sm text-white/70">
          Stage: <span className="font-mono text-white/80">{stage}</span>
        </div>
        {err ? <div className="mt-4 text-sm text-rose-200">{err}</div> : null}
      </div>
    </div>
  );
}

