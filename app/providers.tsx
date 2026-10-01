"use client";

import React from "react";
import { WalletProvider } from "./lib/wallet";
import { AuthProvider } from "./lib/authClient";
import { SkinProvider } from "./lib/skin";
import { UiLayoutProvider } from "./lib/uiLayout";
import { UiScaleProvider } from "./lib/uiScale";
import { ZoneProvider } from "./lib/client/ui/zone";
import { DiscordActivityRouter } from "./components/DiscordActivityRouter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ZoneProvider>
      <SkinProvider>
        <UiLayoutProvider>
          <UiScaleProvider>
            <AuthProvider>
              <WalletProvider><DiscordActivityRouter />{children}</WalletProvider>
            </AuthProvider>
          </UiScaleProvider>
        </UiLayoutProvider>
      </SkinProvider>
    </ZoneProvider>
  );
}
