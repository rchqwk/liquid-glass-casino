"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Topbar } from "../components/Topbar";
import { SignInGate } from "../components/SignInGate";
import { BigWinOverlay } from "../components/BigWinOverlay";
import { MysteryBoxTab } from "../components/MysteryBoxTab";
import { GlobalChatBubble } from "../components/GlobalChatBubble";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";

  // The Discord auth controller needs a completely clean page without any
  // casino chrome, overlays, or auth gates so the Embedded App SDK handshake
  // can complete on mobile before the iframe times out.
  if (path.startsWith("/casino/blackjack/discord")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col">
      <Topbar />
      <BigWinOverlay />
      <MysteryBoxTab />
      <GlobalChatBubble />
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl">
          <SignInGate>{children}</SignInGate>
        </div>
      </main>
    </div>
  );
}
