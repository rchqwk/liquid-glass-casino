"use client";

import React from "react";
import { WalletProvider } from "./lib/wallet";
import { AuthProvider } from "./lib/authClient";
import { SkinProvider } from "./lib/skin";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SkinProvider>
      <AuthProvider>
        <WalletProvider>{children}</WalletProvider>
      </AuthProvider>
    </SkinProvider>
  );
}
