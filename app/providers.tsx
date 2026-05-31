"use client";

import React from "react";
import { WalletProvider } from "./lib/wallet";
import { AuthProvider } from "./lib/authClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WalletProvider>{children}</WalletProvider>
    </AuthProvider>
  );
}
