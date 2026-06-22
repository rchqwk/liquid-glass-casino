"server-only";

import type { TableState } from "./blackjackMultiplayer";
import { upsertBlackjackInventory, upsertBlackjackTable } from "./db";

export type BlackjackTableRecordMeta = {
  id: string;
  public: boolean;
  name: string;
  created_at: number;
};

export async function saveBlackjackTableState(meta: BlackjackTableRecordMeta, state: TableState) {
  await upsertBlackjackTable({
    id: meta.id,
    public: meta.public,
    name: meta.name,
    state,
    created_at: meta.created_at,
    updated_at: state.updatedAt,
  });
  await persistBlackjackStateInventories(state);
}

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
