"use client";

import { useEffect } from "react";

// Legacy entry path. The canonical Discord OAuth entry lives at
// /casino/blackjack-v2/discord (matches the registered redirect URI).
// Preserve the full query string (frame_id, channel_id, code, state, ...).
export default function DiscordLegacyEntryRedirect() {
  useEffect(() => {
    try {
      const search = window.location.search || "";
      window.location.replace(`/casino/blackjack-v2/discord${search}`);
    } catch {
      window.location.replace("/casino/blackjack-v2/discord");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050508",
        color: "rgba(255,255,255,.7)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
      }}
    >
      Redirecting…
    </div>
  );
}
