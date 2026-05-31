import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <main className="glass glass-shine w-full max-w-3xl rounded-3xl p-8 sm:p-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm tracking-wide text-[rgba(245,247,255,0.72)]">
                Prototype • Play-money only
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Liquid Glass Crypto Casino
              </h1>
            </div>
          </div>

          <p className="text-base leading-7 text-[rgba(245,247,255,0.72)]">
            A Next.js web prototype styled like Apple’s “liquid glass”, with
            provably-fair style RNG and a simple local wallet.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="glass-soft glass-shine inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              href="/casino"
            >
              Enter casino
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium text-[rgba(245,247,255,0.72)] transition hover:text-white"
              href="/casino/settings"
            >
              RNG / wallet settings
            </Link>
          </div>

          <p className="text-xs leading-5 text-[rgba(245,247,255,0.55)]">
            Note: This is not a licensed gambling product and does not handle
            real money or crypto deposits/payouts.
          </p>
        </div>
      </main>
    </div>
  );
}
