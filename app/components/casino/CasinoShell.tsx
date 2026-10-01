"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const docs = new Set(["rules", "special-rules", "strategy", "discord", "games"]);

export function CasinoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const table = pathname === "/casino/ui-preview" || (parts.length === 3 && ["blackjack", "blackjack-v2"].includes(parts[1]) && !docs.has(parts[2]));
  return (
    <div className={`casino-shell ${table ? "casino-shell--table" : "casino-shell--browse"}`}>
      <a className="casino-skip" href="#casino-content">Skip to content</a>
      {children}
      <footer className="casino-footer" aria-label="Casino help">
        <span>Liquid Glass Arcade</span>
        <div>
          <Link href="/casino/tutorial">How to play</Link>
          <Link href="/casino/blackjack/rules">Blackjack rules</Link>
          <Link href="/casino/settings">Settings</Link>
        </div>
      </footer>
    </div>
  );
}
