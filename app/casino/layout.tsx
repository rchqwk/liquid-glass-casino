import type { ReactNode } from "react";
import { Topbar } from "../components/Topbar";
import { SignInGate } from "../components/SignInGate";
import { BigWinOverlay } from "../components/BigWinOverlay";
import { MysteryBoxTab } from "../components/MysteryBoxTab";
import { GlobalChatBubble } from "../components/GlobalChatBubble";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col"
      style={{
        backgroundColor: "var(--void)",
        backgroundImage:
          "radial-gradient(1200px 600px at 50% -10%, rgba(0,245,255,0.04) 0%, transparent 60%), radial-gradient(1000px 500px at 90% 110%, rgba(255,0,170,0.03) 0%, transparent 60%)",
      }}
    >
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
