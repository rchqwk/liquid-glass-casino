import type { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";

export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full">
      <Sidebar />

      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

