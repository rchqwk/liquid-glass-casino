"server-only";

import type { Inventory, TableState } from "./blackjackMultiplayer";
import { getBlackjackTable, listBlackjackTables, upsertBlackjackInventory, upsertBlackjackTable } from "./db";

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

export async function syncUserBlackjackInventoryIntoTables(userId: number, inventory: Inventory, tableId?: string | null) {
  const targetTables = tableId
    ? [await getBlackjackTable(String(tableId).slice(0, 48))].filter(Boolean)
    : (await Promise.all((await listBlackjackTables()).map((m) => getBlackjackTable(m.id)))).filter(Boolean);

  const now = Date.now();
  for (const t of targetTables as Array<BlackjackTableRecordMeta & { state: TableState }>) {
    const st: any = t.state ?? {};
    const seats: any[] = Array.isArray(st.seats) ? st.seats : [];
    let touched = false;
    for (const p of seats) {
      if (p && p.userId === userId) {
        p.inventory = inventory;
        touched = true;
      }
    }
    if (touched) {
      st.updatedAt = now;
      await saveBlackjackTableState(t, st as TableState);
    }
  }
}
