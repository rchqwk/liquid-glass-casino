"server-only";

import { shuffleDeck } from "./blackjackCards";
import { normalizeInventory } from "./blackjackInventory";
import { appendBlackjackEvent, initialBlackjackRoomEvents } from "./blackjackRoomFeed";
import { normalizeHandsForSeat } from "./blackjackSeatState";
import type { TableState } from "./blackjackMultiplayer";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s % 1_000_000) / 1_000_000;
  };
}

function buildShoeState(seed: number) {
  const shoe = shuffleDeck(seed);
  const shoeInitialSize = shoe.length;
  const cutRng = lcg(seed ^ 1597334677);
  const cutMin = Math.max(40, Math.floor(shoeInitialSize * 0.65));
  const cutMax = Math.max(cutMin, Math.floor(shoeInitialSize * 0.82));
  const shoeCutCardAt = cutMin + Math.floor(cutRng() * (cutMax - cutMin + 1));
  return { shoe, shoeInitialSize, shoeCutCardAt };
}

export function newBlackjackTableState(input: { id: string; name: string; public: boolean; now: number }): TableState {
  const seed = Math.floor(input.now / 1000) ^ 2654435761;
  const { shoe, shoeInitialSize, shoeCutCardAt } = buildShoeState(seed);
  return {
    id: input.id,
    public: input.public,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    lastActivityAt: input.now,
    turnDurationMs: 30_000,
    disabledCategories: [],
    passwordEnabled: false,
    password: null,
    afkKickEnabled: true,
    chat: [],
    events: initialBlackjackRoomEvents(input.now, shoeCutCardAt),
    decorations: [],
    phase: "betting",
    round: 1,
    bettingEndsAt: input.now + 30_000,
    turnEndsAt: 0,
    dealerWindowEndsAt: 0,
    seats: Array.from({ length: 10 }, () => null),
    spectators: [],
    participants: [],
    turnIndex: 0,
    shoe,
    shoeInitialSize,
    shoeCardsDealt: 0,
    shoeCutCardAt,
    shoeShufflePending: false,
    dealer: { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false, effects: [] },
    dealerBlackjack: false,
    peekByUserId: {},
    evictedInventories: [],
    lastResults: {},
  };
}

export function startBlackjackBetting(state: TableState, now: number) {
  const s: TableState = { ...state };
  s.phase = "betting";
  s.bettingEndsAt = now + 30_000;
  s.turnEndsAt = 0;
  s.dealerWindowEndsAt = 0;
  s.participants = [];
  s.turnIndex = 0;
  s.dealer = { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false, effects: [] };
  s.dealerBlackjack = false;
  s.peekByUserId = {};
  s.lastResults = s.lastResults ?? {};
  s.evictedInventories = s.evictedInventories ?? [];

  if (!Array.isArray(s.shoe) || s.shoe.length === 0 || s.shoeShufflePending) {
    const seed = Math.floor(now / 1000) ^ (s.round * 2654435761);
    const { shoe, shoeInitialSize, shoeCutCardAt } = buildShoeState(seed);
    s.shoe = shoe;
    s.shoeInitialSize = shoeInitialSize;
    s.shoeCardsDealt = 0;
    s.shoeCutCardAt = shoeCutCardAt;
    s.shoeShufflePending = false;
    appendBlackjackEvent(s, now, `The deck has been shuffled. A new shoe card was placed at card number ${s.shoeCutCardAt}.`);
  }

  for (let i = 0; i < s.seats.length; i++) {
    const p = s.seats[i];
    if (!p) continue;
    p.inventory = normalizeInventory(p.inventory);
    p.skipThisRound = false;
    normalizeHandsForSeat(p);
    const carry = Number(p.carryBetNext ?? 0) || 0;
    p.hands = [
      {
        bet: carry,
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
    ];
    p.activeHandIndex = 0;
    normalizeHandsForSeat(p);
    p.carryBetNext = 0;
    p.bjProtected = false;
    p.extendUsedThisTurn = false;
  }
  s.round += 1;
  s.updatedAt = now;
  return s;
}

export function drawBlackjackCardFromShoe(s: TableState): number | null {
  const next = s.shoe.pop();
  if (typeof next === "number") {
    s.shoeCardsDealt = Math.max(0, Number(s.shoeCardsDealt ?? 0) || 0) + 1;
    const cutAt = Math.max(0, Number(s.shoeCutCardAt ?? 0) || 0);
    if (!s.shoeShufflePending && cutAt > 0 && s.shoeCardsDealt >= cutAt) {
      s.shoeShufflePending = true;
      appendBlackjackEvent(s, Date.now(), `The shoe card has been reached at card number ${cutAt}. The deck will be shuffled after this hand.`);
    }
  }
  return typeof next === "number" ? next : null;
}

export function currentBlackjackTurnSeatIndex(s: TableState) {
  return s.participants[s.turnIndex] ?? null;
}

export function blackjackTurnDurationMs(s: TableState) {
  const v = Number(s.turnDurationMs ?? 30_000);
  return v === 60_000 ? 60_000 : 30_000;
}

export function advanceBlackjackTurn(state: TableState, now: number): TableState {
  const s: TableState = { ...state };
  while (s.turnIndex < s.participants.length) {
    const seatIdx = s.participants[s.turnIndex]!;
    const p = s.seats[seatIdx];
    if (!p) {
      s.turnIndex += 1;
      continue;
    }
    normalizeHandsForSeat(p);
    const nextHandIdx = (p.hands ?? []).findIndex((h: any) => !h?.turnEnded);
    if (nextHandIdx < 0) {
      s.turnIndex += 1;
      continue;
    }
    p.activeHandIndex = nextHandIdx;
    normalizeHandsForSeat(p);
    s.turnEndsAt = now + blackjackTurnDurationMs(s);
    p.extendUsedThisTurn = false;
    s.updatedAt = now;
    return s;
  }
  s.phase = "dealer";
  s.turnEndsAt = 0;
  s.updatedAt = now;
  return s;
}
