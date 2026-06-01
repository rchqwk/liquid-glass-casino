import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackInventory, getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { defaultInventory, ensureInventory, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { spectate?: boolean } | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);
  state.lastActivityAt = now;

  // Already seated?
  if (state.seats.some((p) => p?.userId === user.id)) {
    await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state, created_at: t.created_at, updated_at: state.updatedAt });
    return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
  }

  const seatOpen = state.seats.findIndex((p) => !p);
  const wantsSpectate = !!body?.spectate;
  if (seatOpen < 0 || wantsSpectate) {
    // spectate
    if (!state.spectators.includes(user.id)) state.spectators.push(user.id);
  } else {
    const inv = ensureInventory((await getBlackjackInventory(user.id)) ?? defaultInventory());
    state.seats[seatOpen] = {
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
    await upsertBlackjackInventory(user.id, inv);
  }

  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state, created_at: t.created_at, updated_at: state.updatedAt });
  for (const p of state.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
  for (const ev of state.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
  state.evictedInventories = [];
  return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
}
