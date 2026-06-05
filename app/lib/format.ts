export function formatNumberWords(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);

  // Abbreviate only for very large values (>= 1 quadrillion).
  if (abs < 1_000_000_000_000_000) {
    return sign + abs.toLocaleString();
  }

  const scales: Array<{ v: number; w: string }> = [
    { v: 1e33, w: "decillion" },
    { v: 1e30, w: "nonillion" },
    { v: 1e27, w: "octillion" },
    { v: 1e24, w: "septillion" },
    { v: 1e21, w: "sextillion" },
    { v: 1e18, w: "quintillion" },
    { v: 1e15, w: "quadrillion" },
  ];
  const s = scales.find((t) => abs >= t.v) ?? scales[scales.length - 1]!;
  const val = abs / s.v;

  const decimals = val >= 100 ? 0 : val >= 10 ? 1 : 2;
  let num = val.toFixed(decimals);
  num = num.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  return `${sign}${num} ${s.w}`;
}

export function formatChips(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  const abs = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  if (abs < 1_000_000_000_000_000) return `${sign}${abs.toFixed(2)}`;
  return formatNumberWords(x);
}

