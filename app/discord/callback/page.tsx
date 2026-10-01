"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/authClient";
import { exchangeDiscordCode, discordReturnPath } from "../../lib/discordClient";

export default function DiscordCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<"init" | "logging_in" | "redirecting" | "linked" | "error">("init");

  const qs = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams;
  }, []);

  const code = useMemo(() => qs?.get("code") ?? null, [qs]);
  const state = useMemo(() => qs?.get("state") ?? "/", [qs]);
  const mobileAuthCode = useMemo(() => {
    const raw = String(state ?? "");
    return raw.startsWith("mobile:") ? raw.slice("mobile:".length).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) : null;
  }, [state]);
  const redirectUri =
    process.env.NEXT_PUBLIC_DISCORD_WEB_REDIRECT_URI ??
    "https://rchqwk-liquid-glass-casino.vercel.app/discord/callback";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!code) throw new Error("Missing code");
        setStage("logging_in");
        const data = await exchangeDiscordCode(code, redirectUri, mobileAuthCode);
        if (cancelled) return;
        if (data?.session_token) {
          try {
            localStorage.setItem("lgc.session", String(data.session_token));
          } catch {
            // ignore
          }
        }
        if (mobileAuthCode) {
          setStage("linked");
          return;
        }
        setStage("redirecting");
        await refresh();
        router.replace(discordReturnPath(state));
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErr(String(e?.message ?? "Discord login failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, redirectUri, state, mobileAuthCode]);

  return (
    <div className="mx-auto w-full max-w-xl p-6 sm:p-10">
      <div className="glass glass-shine rounded-3xl p-8">
        <div className="text-lg font-semibold text-white">Signing in with Discord…</div>
        <div className="mt-2 text-sm text-white/70">
          Stage: <span className="font-mono text-white/80">{stage}</span>
        </div>
        {stage === "linked" ? (
          <div className="mt-4 text-sm text-emerald-200">
            Discord sign-in completed. Return to the Discord Activity and it should continue automatically.
          </div>
        ) : null}
        {err ? <div className="mt-4 text-sm text-rose-200">{err}</div> : null}
      </div>
    </div>
  );
}
