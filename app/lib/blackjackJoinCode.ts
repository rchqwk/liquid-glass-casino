const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashString(input: string) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return h1 >>> 0;
}

export function blackjackJoinCodeFromTable(tableId: string, createdAt: number) {
  const seed = `${String(tableId ?? "").slice(0, 48)}:${Math.max(0, Number(createdAt ?? 0) || 0)}`;
  let n = hashString(seed);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET[n % ALPHABET.length] ?? "X";
    n = Math.floor(n / ALPHABET.length);
    if (n <= 0) n = hashString(`${seed}:${i}`);
  }
  return out;
}

export function normalizeBlackjackJoinCode(raw: string) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

