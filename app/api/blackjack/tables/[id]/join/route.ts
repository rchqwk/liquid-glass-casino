import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackInventory, getBlackjackTable, upsertBlackjackInventory } from "../../../../../lib/db";
import { safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { defaultInventory, ensureInventory } from "../../../../../lib/blackjackInventory";
import { syncPlacedCollectiblesToBlackjackDecorations } from "../../../../../lib/blackjackDecorations";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { spectate?: boolean; password?: string } | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);
  state.lastActivityAt = now;

  // Password gate (applies to both seating and spectating).
  if (state.passwordEnabled) {
    const provided = String(body?.password ?? "");
    const expected = String(state.password ?? "");
    if (!expected || provided !== expected) {
      return NextResponse.json({ error: "Incorrect room password." }, { status: 403 });
    }
  }

  // Already seated?
  if (state.seats.some((p) => p?.userId === user.id)) {
    // Ensure their placed collectibles are present on the felt.
    const me = state.seats.find((p) => p?.userId === user.id);
    if (me) {
      me.inventory = ensureInventory(me.inventory);
      (me as any).avatarUrl = ((user as any).discord_avatar_url ?? null) as any;
      const placed = (me.inventory as any)?.collectibles?.placed ?? [];
      syncPlacedCollectiblesToBlackjackDecorations(state, user.id, placed, now);
    }
    await saveBlackjackTableState(t, state);
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
      prestigeLevel: Number((user as any).prestige_level ?? 0),
      nameColor: ((user as any).name_color ?? null) as any,
      avatarUrl: ((user as any).discord_avatar_url ?? null) as any,
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
    await upsertBlackjackInventory(user.id, inv);

    const placed = (inv as any)?.collectibles?.placed ?? [];
    syncPlacedCollectiblesToBlackjackDecorations(state, user.id, placed, now);
  }

  await saveBlackjackTableState(t, state);
  return NextResponse.json({ state: safePublicStateForUser(state, user.id) });
}
