import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getBlackjackTable, listBlackjackTables, upsertBlackjackTable, upsertBlackjackInventory, getBlackjackInventory } from "../../../lib/db";
import { defaultInventory, newTableState, safePublicStateForUser, tickTable } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shortId() {
  return Math.random().toString(16).slice(2, 10);
}

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metas = await listBlackjackTables();
  const now = Date.now();
  const out: any[] = [];
  for (const m of metas) {
    if (!m.public) continue;
    const t = await getBlackjackTable(m.id);
    if (!t) continue;
    const state = tickTable(t.state, now);
    // persist tick updates lazily
    if (state.updatedAt !== t.updated_at) {
      await upsertBlackjackTable({
        id: t.id,
        public: t.public,
        name: t.name,
        state,
        created_at: t.created_at,
        updated_at: state.updatedAt,
      });
      for (const p of state.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
      for (const ev of state.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
      state.evictedInventories = [];
    }
    const seatsFilled = state.seats.filter(Boolean).length;
    const spectators = state.spectators.length;
    out.push({
      id: t.id,
      name: t.name,
      public: t.public,
      phase: state.phase,
      round: state.round,
      seatsFilled,
      spectators,
      bettingEndsAt: state.bettingEndsAt,
      updatedAt: state.updatedAt,
    });
  }
  return NextResponse.json({ tables: out });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { name?: string; public?: boolean } | null;
  const name = String(body?.name ?? "Blackjack Table").slice(0, 48);
  const pub = body?.public !== false;
  const now = Date.now();
  const id = shortId();

  const state = newTableState({ id, name, public: pub, now });

  // seat creator
  const inv = (await getBlackjackInventory(user.id)) ?? defaultInventory();
  state.seats[0] = {
    userId: user.id,
    username: user.username,
    joinedAt: now,
    lastSeenAt: now,
    missedRounds: 0,
    skipThisRound: false,
    inventory: inv,
    bet: 0,
    cards: [],
    bonusPoints: 0,
    stood: false,
    busted: false,
    turnEnded: false,
    doublePayoutArmed: false,
    usedThisRound: {},
  };

  await upsertBlackjackTable({ id, public: pub, name, state, created_at: now, updated_at: now });
  await upsertBlackjackInventory(user.id, inv);

  return NextResponse.json({ tableId: id, state: safePublicStateForUser(state, user.id) });
}
