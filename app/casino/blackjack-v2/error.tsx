"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BlackjackV2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Blackjack V2 route error", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="glass glass-shine w-full max-w-2xl rounded-3xl border border-white/10 p-8 text-white">
        <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-100">
          BLACKJACK LIVE
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">Blackjack couldn’t load right now.</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          This is usually temporary. If Vercel throttled or dropped the request, retrying normally brings the live lobby back.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
            onClick={() => reset()}
          >
            Retry
          </button>
          <Link
            href="/casino/blackjack-v2"
            className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Reload live lobby
          </Link>
          <Link
            href="/casino"
            className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10"
          >
            Back to casino
          </Link>
        </div>

        <div className="mt-5 text-xs text-white/45">If it keeps happening, retry from the live lobby instead of refreshing the whole site.</div>
      </div>
    </div>
  );
}

