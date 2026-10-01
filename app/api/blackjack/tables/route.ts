import { retryBlackjack } from "../../../lib/blackjackStatePersistence";
import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import {
  getBlackjackTable,
  listBlackjackTables,
  upsertBlackjackTable,
  getBlackjackInventory,
} from "../../../lib/db";
import { newTableState, tickTable } from "../../../lib/blackjackMultiplayer";
import { defaultInventory, ensureInventory } from "../../../lib/blackjackInventory";
import { persistBlackjackStateInventories, saveBlackjackTableState } from "../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../lib/blackjackTableContract";
import { shortId } from "../../../lib/blackjackUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GETImpl() {
  // Public discovery returns only public room metadata. Guests never tick or persist game state.
  const user = await getAuthedUserAsync();

  const metas = await listBlackjackTables();
  const now = Date.now();
  const out: any[] = [];
  for (const m of metas) {
    if (!m.public) continue;
    const t = await getBlackjackTable(m.id);
    if (!t) continue;
    const state = user ? tickTable(t.state, now) : t.state;

    // Close rooms after 5 minutes of inactivity (no players + no spectators).
    const empty = state.seats.filter(Boolean).length === 0 && (state.spectators?.length ?? 0) === 0;
    const lastAct = Number(state.lastActivityAt ?? t.updated_at ?? t.created_at ?? 0);
    if (empty && lastAct > 0 && now - lastAct > 5 * 60 * 1000) {
      // Soft-delete by making it non-public and skipping it; a later cleanup can hard-delete.
      if (user) await saveBlackjackTableState({...t, public:false}, state);
      continue;
    }
    // persist tick updates lazily
    if (user && state.updatedAt !== t.updated_at) {
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

async function POSTImpl(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { name?: string; public?: boolean } | null;
  const name = String(body?.name ?? "Blackjack Table").slice(0, 48);
  const pub = body?.public !== false;
  const now = Date.now();
  const id = shortId();

  const state = newTableState({ id, name, public: pub, now });

  // seat creator
  const originalInventory = (await getBlackjackInventory(user.id)) ?? defaultInventory();
  const sourceInventories = { [user.id]: JSON.stringify(originalInventory) };
  const inv = ensureInventory(structuredClone(originalInventory));
  state.seats[0] = {
    userId: user.id,
    username: user.username,
    prestigeLevel: Number((user as any).prestige_level ?? 0),
    nameColor: ((user as any).name_color ?? null) as any,
    avatarUrl: ((user as any).discord_avatar_url ?? null) as any,
    joinedAt: now,
    lastSeenAt: now,
    missedRounds: 0,
    skipThisRound: false,
    ready: false,
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

  await saveBlackjackTableState({ id, public: pub, name, created_at: now, sourceInventories }, state);

  // Verify table is readable (catches DB misconfiguration / split stores).
  const check = await getBlackjackTable(id);
  if (!check) {
    return NextResponse.json(
      { error: "Table created but not readable." },
      { status: 500 },
    );
  }

  return blackjackTableJsonResponse(state, user.id, { extra: { tableId: id } });
}

export async function GET(req: Request) { return retryBlackjack(() => GETImpl()); }

export async function POST(req: Request) { return retryBlackjack(() => POSTImpl(req.clone())); }
