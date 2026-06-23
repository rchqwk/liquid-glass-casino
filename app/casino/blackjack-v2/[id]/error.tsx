"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BlackjackV2TableError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Blackjack V2 table route error", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="glass glass-shine w-full max-w-2xl rounded-3xl border border-white/10 p-8 text-white">
        <div className="inline-flex rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-fuchsia-100">
          BLACKJACK TABLE
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">This live table hit a temporary load issue.</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          The hand or table request likely got interrupted upstream. Retry first, or jump back to the live lobby and reopen the table.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
            onClick={() => reset()}
          >
            Retry table
          </button>
          <Link
            href="/casino/blackjack-v2"
            className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Back to live lobby
          </Link>
          <Link
            href="/casino"
            className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10"
          >
            Back to casino
          </Link>
        </div>

        <div className="mt-5 text-xs text-white/45">This keeps users on your branded recovery screen instead of the default Vercel load-failure page.</div>
      </div>
    </div>
  );
}

