"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/authClient";
import { discordReturnPath, exchangeDiscordCode } from "../lib/discordClient";

export function DiscordRootCallback({ code, state }: { code: string; state?: string | null }) {
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useAuth();
  const [stage, setStage] = useState<"logging_in" | "redirecting" | "linked" | "error">("logging_in");
  const mobileAuthCode = state?.startsWith("mobile:") ? state.slice(7).replace(/[^a-z0-9]/gi, "").toUpperCase() : null;

  const returnTo = useMemo(() => {
    const s = String(state ?? "");
    if (s) return discordReturnPath(s);
    try {
      const stored = sessionStorage.getItem("lgc.discord.webReturnTo") ?? "";
      if (stored) return discordReturnPath(stored);
    } catch {
      // ignore
    }
    return "/casino/blackjack-v2";
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "https://rchqwk.com";
        setStage("logging_in");
        const storedRedirect = sessionStorage.getItem("lgc.discord.redirectUri");
        const data = await exchangeDiscordCode(code, storedRedirect || redirectUri, mobileAuthCode);
        if (cancelled) return;
        if (data?.session_token) {
          try {
            localStorage.setItem("lgc.session", String(data.session_token));
          } catch {
            // ignore
          }
        }
        if (mobileAuthCode) { setStage("linked"); return; }
        await refresh();
        setStage("redirecting");
        router.replace(returnTo);
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
        {stage === "linked" ? <p className="mt-4 text-emerald-200">Discord sign-in completed. Return to the Activity to continue.</p> : null}
        {err ? <div className="mt-4 text-sm text-rose-200">{err}</div> : null}
      </main>
    </div>
  );
}
