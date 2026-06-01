import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import {
  getBlackjackTable,
  listBlackjackTables,
  upsertBlackjackTable,
  upsertBlackjackInventory,
  getBlackjackInventory,
} from "../../../lib/db";
import { defaultInventory, ensureInventory, newTableState, safePublicStateForUser, tickTable } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbSource() {
  if (process.env.POSTGRES_URL) return "POSTGRES_URL";
  if (process.env.NEON_DATABASE_URL) return "NEON_DATABASE_URL";
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  return "file";
}

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

    // Close rooms after 5 minutes of inactivity (no players + no spectators).
    const empty = state.seats.filter(Boolean).length === 0 && (state.spectators?.length ?? 0) === 0;
    const lastAct = Number(state.lastActivityAt ?? t.updated_at ?? t.created_at ?? 0);
    if (empty && lastAct > 0 && now - lastAct > 5 * 60 * 1000) {
      // Soft-delete by making it non-public and skipping it; a later cleanup can hard-delete.
      await upsertBlackjackTable({
        id: t.id,
        public: false,
        name: t.name,
        state,
        created_at: t.created_at,
        updated_at: state.updatedAt,
      });
      continue;
    }
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
  return NextResponse.json({ tables: out, dbSource: dbSource() });
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
  const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? defaultInventory());
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
    bjProtected: false,
    extendUsedThisTurn: false,
  };

  await upsertBlackjackTable({ id, public: pub, name, state, created_at: now, updated_at: now });
  await upsertBlackjackInventory(user.id, inv);

  // Verify table is readable (catches DB misconfiguration / split stores).
  const check = await getBlackjackTable(id);
  if (!check) {
    return NextResponse.json(
      { error: "Table created but not readable (DB mismatch).", dbSource: dbSource() },
      { status: 500 },
    );
  }

  return NextResponse.json({ tableId: id, state: safePublicStateForUser(state, user.id), dbSource: dbSource() });
}
