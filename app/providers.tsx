"use client";

import React from "react";
import { WalletProvider } from "./lib/wallet";
import { AuthProvider } from "./lib/authClient";
import { SkinProvider } from "./lib/skin";
import { UiLayoutProvider } from "./lib/uiLayout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SkinProvider>
      <UiLayoutProvider>
        <AuthProvider>
          <WalletProvider>{children}</WalletProvider>
        </AuthProvider>
      </UiLayoutProvider>
    </SkinProvider>
  );
}
