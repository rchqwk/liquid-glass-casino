"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/authClient";
import { discordLaunchParams } from "../lib/discordClient";

// Existing and newly arriving Activity participants follow the call's active game.
export function DiscordActivityRouter() {
  const { user, discordMode } = useAuth();
  const pathname = usePathname(), router = useRouter();
  useEffect(() => {
    if (!user || !discordMode || !/^\/casino\/blackjack(?:-v2)?(?:\/[^/]+)?$/.test(pathname) || pathname.endsWith("/discord")) return;
    if (["rules", "special-rules", "strategy"].includes(pathname.split("/").at(-1) ?? "")) return;
    const channelId = discordLaunchParams().get("channel_id");
    if (!channelId) return;
    let cancelled = false, pending = false;
    const check = async () => {
      if (pending) return;
      pending = true;
      try {
        const res = await fetch(`/api/roguelike/activity?channelId=${encodeURIComponent(channelId)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.active && !cancelled) router.replace("/arcade/blackjack-roguelike?multiplayer=1");
      } catch { /* Keep the current game through transient outages. */ }
      finally { pending = false; }
    };
    void check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user, discordMode, pathname, router]);
  return null;
}
