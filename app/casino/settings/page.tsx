"use client";

import { useMemo, useState } from "react";
import { useWallet } from "../../lib/wallet";

export default function SettingsPage() {
  const { serverSeedHash, clientSeed, setClientSeed, nonce, rotateServerSeed } =
    useWallet();
  const [seedDraft, setSeedDraft] = useState(clientSeed);
  const [reveal, setReveal] = useState<string | null>(null);

  const shortHash = useMemo(
    () => (serverSeedHash ? `${serverSeedHash.slice(0, 10)}…` : ""),
    [serverSeedHash],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          This service uses a “commit → reveal” flow. The app commits to a
          server seed hash, then uses <code>serverSeed:clientSeed:nonce</code> to
          derive outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Server seed (commit)</p>
          <p className="mt-2 break-all font-mono text-xs text-white/70">
            Hash: {serverSeedHash}
          </p>
          <p className="mt-2 text-xs text-white/55">Short: {shortHash}</p>

          <button
            className="mt-4 glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
            type="button"
            onClick={() => {
              const { revealedServerSeed } = rotateServerSeed();
              setReveal(revealedServerSeed);
            }}
          >
            Rotate server seed (reveal previous)
          </button>

          {reveal && (
            <div className="mt-4 rounded-2xl border border-white/10 p-3">
              <p className="text-xs font-medium text-white/70">
                Revealed previous server seed
              </p>
              <p className="mt-2 break-all font-mono text-xs text-white/70">
                {reveal}
              </p>
            </div>
          )}
        </div>

        <div className="glass-soft glass-shine rounded-3xl p-5">
          <p className="text-sm font-medium text-white">Client seed</p>
          <p className="mt-2 text-xs text-white/55">
            You can set this to any text you like.
          </p>

          <input
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            placeholder="e.g. tim-2026-05-31"
          />
          <div className="mt-3 flex gap-2">
            <button
              className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10"
              type="button"
              onClick={() => setClientSeed(seedDraft)}
            >
              Save seed
            </button>
          </div>

          <div className="mt-4 text-xs text-white/60">
            Current nonce: <span className="font-mono">{nonce}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
