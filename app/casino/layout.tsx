import type { ReactNode } from "react";
import { Topbar } from "../components/Topbar";
import { SignInGate } from "../components/SignInGate";
import { BigWinOverlay } from "../components/BigWinOverlay";
import { MysteryBoxTab } from "../components/MysteryBoxTab";
import { GlobalChatBubble } from "../components/GlobalChatBubble";
import { CasinoShell } from "../components/casino/CasinoShell";
import "./casino.css";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <CasinoShell>
      <Topbar />
      <BigWinOverlay compact />
      <main id="casino-content" tabIndex={-1} className="casino-main">
        <div className="casino-content">
          <SignInGate>{children}</SignInGate>
        </div>
      </main>
      <MysteryBoxTab />
      <GlobalChatBubble />
    </CasinoShell>
  );
}
