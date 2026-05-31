import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function sha256Hex(message: string): string {
  return bytesToHex(sha256(utf8Bytes(message)));
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

/**
 * Deterministic RNG stream:
 * H = SHA256(serverSeed:clientSeed:nonce:index)
 *
 * Convert the first 52 bits of H to a float in [0,1).
 */
export function rngFloat(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  index: number;
}): number {
  const h = sha256Hex(
    `${params.serverSeed}:${params.clientSeed}:${params.nonce}:${params.index}`,
  );

  // Use 13 hex chars = 52 bits to keep it in JS safe integer range.
  const slice = h.slice(0, 13);
  const n = parseInt(slice, 16);
  return n / 2 ** 52;
}

export function rngInt(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  index: number;
  maxExclusive: number;
}): number {
  return Math.floor(
    rngFloat({
      serverSeed: params.serverSeed,
      clientSeed: params.clientSeed,
      nonce: params.nonce,
      index: params.index,
    }) * params.maxExclusive,
  );
}
