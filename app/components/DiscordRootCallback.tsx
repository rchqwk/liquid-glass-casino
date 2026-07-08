"use client";

import { useEffect, useMemo, useState } from "react";

export function DiscordRootCallback({ code, state }: { code: string; state?: string | null }) {
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<"logging_in" | "redirecting" | "error">("logging_in");

  const returnTo = useMemo(() => {
    const s = String(state ?? "");
    if (s && s.startsWith("/")) return s;
    try {
      const stored = sessionStorage.getItem("lgc.discord.webReturnTo") ?? "";
      if (stored.startsWith("/")) return stored;
    } catch {
      // ignore
    }
    return "/casino";
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const redirectUri =
          process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ||
          (typeof window !== "undefined" ? window.location.origin : "https://rchqwk.com");
        setStage("logging_in");
        const res = await fetch("/api/discord/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(data?.error ?? "Discord login failed");
        if (cancelled) return;
        if (data?.session_token) {
          try {
            localStorage.setItem("lgc.session", String(data.session_token));
          } catch {
            // ignore
          }
        }
        setStage("redirecting");
        window.location.href = returnTo;
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErr(String(e?.message ?? "Discord login failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, returnTo]);

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center px-6 py-12">
      <main className="glass glass-shine w-full max-w-xl rounded-3xl p-8 sm:p-10">
        <div className="text-lg font-semibold text-white">Signing in with Discord…</div>
        <div className="mt-2 text-sm text-white/70">
          Stage: <span className="font-mono text-white/80">{stage}</span>
        </div>
        {err ? <div className="mt-4 text-sm text-rose-200">{err}</div> : null}
      </main>
    </div>
  );
}

