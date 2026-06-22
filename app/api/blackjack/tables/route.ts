import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import {
  getBlackjackTable,
  listBlackjackTables,
  upsertBlackjackTable,
  getBlackjackInventory,
} from "../../../lib/db";
import { newTableState, safePublicStateForUser, tickTable } from "../../../lib/blackjackMultiplayer";
import { defaultInventory, ensureInventory } from "../../../lib/blackjackInventory";
import { persistBlackjackStateInventories, saveBlackjackTableState } from "../../../lib/blackjackStatePersistence";
import { shortId } from "../../../lib/blackjackUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      await saveBlackjackTableState(t, state);
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
    hands: [
      {
        bet: 0,
        nonces: [],
        perfectPairsWager: 0,
        perfectPairsNonce: null,
        perfectPairsSettled: false,
        cards: [],
        bonusPoints: 0,
        stood: false,
        busted: false,
        turnEnded: false,
        doublePayoutArmed: false,
        usedThisRound: {},
      },
    ],
    activeHandIndex: 0,
    lastBetPlaced: 0,
    carryBetNext: 0,
    bjProtected: false,
    extendUsedThisTurn: false,
  };

  await saveBlackjackTableState({ id, public: pub, name, created_at: now }, state);

  // Verify table is readable (catches DB misconfiguration / split stores).
  const check = await getBlackjackTable(id);
  if (!check) {
    return NextResponse.json(
      { error: "Table created but not readable." },
      { status: 500 },
    );
  }

  return NextResponse.json({ tableId: id, state: safePublicStateForUser(state, user.id) });
}
