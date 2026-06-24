export const QUICK_REFILL_DEFAULT_AMOUNT = 100;
export const QUICK_REFILL_EVENT_AMOUNT = 50_000;
export const QUICK_REFILL_COOLDOWN_MS = 60 * 1000;
export const LARGE_REFILL_COOLDOWN_MS = 15 * 60 * 1000;

export function getQuickRefillInfo(now = Date.now()) {
  const d = new Date(now);
  const utcHour = d.getUTCHours();
  const isEventActive = utcHour >= 21 && utcHour < 24;
  return {
    isEventActive,
    amount: isEventActive ? QUICK_REFILL_EVENT_AMOUNT : QUICK_REFILL_DEFAULT_AMOUNT,
  };
}

