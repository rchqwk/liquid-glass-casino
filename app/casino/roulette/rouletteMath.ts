export const EUROPEAN_ORDER: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function colorOf(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

export type BetKey =
  | `n:${number}` // straight up number
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high";

export function payoutMultiplierForKey(key: BetKey, spun: number): number {
  if (key.startsWith("n:")) {
    const pick = Number(key.slice(2));
    return spun === pick ? 36 : 0;
  }

  switch (key) {
    case "red":
      return colorOf(spun) === "red" ? 2 : 0;
    case "black":
      return colorOf(spun) === "black" ? 2 : 0;
    case "odd":
      return spun !== 0 && spun % 2 === 1 ? 2 : 0;
    case "even":
      return spun !== 0 && spun % 2 === 0 ? 2 : 0;
    case "low":
      return spun >= 1 && spun <= 18 ? 2 : 0;
    case "high":
      return spun >= 19 && spun <= 36 ? 2 : 0;
  }

  return 0;
}
