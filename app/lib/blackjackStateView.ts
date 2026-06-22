"server-only";

import type { TableState } from "./blackjackMultiplayer";

function clampStreak(n: number) {
  return Math.max(0, Math.floor(Number(n ?? 0) || 0));
}

export function safePublicBlackjackStateForUser(state: TableState, userId: number) {
  const { password: _pw, ...rest } = state as any;
  const meSeat = state.seats.find((p) => p?.userId === userId) ?? null;
  const peek = state.peekByUserId[String(userId)] ?? null;
  const hideDealerHole = state.phase === "player_turns";
  const dealerCards = hideDealerHole ? state.dealer.cards.map((c, i) => (i === 1 ? -1 : c)) : state.dealer.cards;

  const seats = (state.seats ?? []).map((p) => {
    if (!p) return null;
    const rawInv = (p as any).inventory ?? null;
    const { inventory: _inv, ...pRest } = p as any;
    return {
      ...pRest,
      allInWinStreak: clampStreak(Number(rawInv?.allInWinStreak ?? 0)),
    };
  });

  return {
    ...rest,
    seats,
    dealer: { ...state.dealer, cards: dealerCards },
    peekCard: peek,
    meSeatIndex: state.seats.findIndex((p) => p?.userId === userId),
    meInventory: meSeat?.inventory ?? null,
    lastResult: state.lastResults?.[String(userId)] ?? null,
  };
}
