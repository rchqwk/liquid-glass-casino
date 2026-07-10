import { createHash, randomBytes } from "node:crypto";

export type CommitReveal = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string | null;
  nonce: number;
};

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

export function createServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function makeCommitReveal(clientSeed: string | null = null, nonce = 0): CommitReveal {
  const serverSeed = createServerSeed();
  return {
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    nonce,
  };
}

export function rngFloat(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const hi = view.getUint32(0, false) >>> 0;
  const lo = view.getUint32(4, false) >>> 0;
  const combined = (hi * 0x100000000 + lo) / 0x100000000 / 0x100000000;
  return combined;
}

export function rngInt(seed: string, minInclusive: number, maxInclusive: number): number {
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rngFloat(seed) * span);
}

export function composeSeed(cr: CommitReveal, purpose: string, extra = ""): string {
  return [cr.serverSeed, cr.clientSeed ?? "", cr.nonce, purpose, extra].join(":");
}

export function shuffle<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  let sp = 1;
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(`${seed}:${sp++}`, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
