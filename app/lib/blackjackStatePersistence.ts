"server-only";

import type { TableState } from "./blackjackMultiplayer";
import { upsertBlackjackInventory } from "./db";

export async function persistBlackjackStateInventories(state: TableState) {
  for (const p of state.seats) {
    if (!p) continue;
    await upsertBlackjackInventory(p.userId, p.inventory);
  }
  for (const ev of state.evictedInventories ?? []) {
    await upsertBlackjackInventory(ev.userId, ev.inventory);
  }
  state.evictedInventories = [];
}
