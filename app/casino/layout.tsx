import type { ReactNode } from "react";
import { Topbar } from "../components/Topbar";
import { SignInGate } from "../components/SignInGate";
import { BigWinOverlay } from "../components/BigWinOverlay";
import { MysteryBoxTab } from "../components/MysteryBoxTab";
import { GlobalChatBubble } from "../components/GlobalChatBubble";
import { OnboardingTutorial } from "../components/OnboardingTutorial";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col">
      <Topbar />
      <BigWinOverlay />
      <MysteryBoxTab />
      <GlobalChatBubble />
      <OnboardingTutorial />
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-5xl">
          <SignInGate>{children}</SignInGate>
        </div>
      </main>
    </div>
  );
}
