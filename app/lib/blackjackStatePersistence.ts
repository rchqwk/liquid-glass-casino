"server-only";

import { operationContext } from "./blackjackOperation";
import type { TableState } from "./blackjackMultiplayer";
import type { Inventory } from "./blackjackInventory";
import { getBlackjackTable, listBlackjackTables, upsertBlackjackInventory, upsertBlackjackTable, commitBlackjackState } from "./db";

export type BlackjackTableRecordMeta = {
  id: string;
  public: boolean;
  name: string;
  created_at: number;
  sourceStateJson?: string;
  sourceInventories?: Record<string,string>;
};

export async function saveBlackjackTableState(meta: BlackjackTableRecordMeta, state: TableState) {
  const context=operationContext.getStore();
  if(context){if(context.pending)throw new Error("Multiple table commits in one request are unsupported");context.pending={meta,state};return;}
  if (!await commitBlackjackState(meta, state)) throw new BlackjackConflict();
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

export class BlackjackConflict extends Error {}
export async function retryBlackjack(operation: () => Promise<Response>): Promise<Response> {
  for(let attempt=0;attempt<5;attempt++){try{return await operation();}catch(error){if(!(error instanceof BlackjackConflict))throw error;}}
  return new Response(JSON.stringify({error:"Table changed; please retry your action."}),{status:409,headers:{"Content-Type":"application/json"}});
}
