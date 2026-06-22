"server-only";

import type { Inventory } from "./blackjackInventory";

export function shortId() {
  return Math.random().toString(16).slice(2, 10);
}

export function shortLongId() {
  return shortId() + shortId();
}

export function shortChatId() {
  return shortLongId();
}

export function shortEventId() {
  return shortLongId();
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s % 1_000_000) / 1_000_000;
  };
}

export function randomCollectibleKey(seed: number) {
  const keys = ["SODA_CUP", "CHICKEN_WING", "FRIES", "DICE"];
  const r = lcg(seed)();
  return keys[Math.floor(r * keys.length)] ?? "SODA_CUP";
}

export function collectibleEmoji(key: string) {
  const map: Record<string, string> = { SODA_CUP: "🥤", CHICKEN_WING: "🍗", FRIES: "🍟", DICE: "🎲" };
  return map[key] ?? "🎁";
}

export function applyBondAccrual(inv: Inventory, now: number) {
  const b = inv.bond;
  const active = b?.active;
  if (!b || !active) return false;
  const last = Number(active.lastAccrualAt ?? active.startedAt ?? 0) || 0;
  if (!last || now <= last) return false;
  const periods = Math.floor((now - last) / 60_000);
  if (periods <= 0) return false;
  const factor = Math.pow(1.2, periods);
  active.value = roundMoney(Math.max(0, Number(active.value ?? 0) || 0) * factor);
  active.lastAccrualAt = last + periods * 60_000;
  return true;
}
