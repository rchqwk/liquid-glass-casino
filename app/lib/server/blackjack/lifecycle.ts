"server-only";

import { BLACKJACK } from "../../shared/constants";
import type { BlackjackInventory as Inventory, BlackjackTable, PlayerSeat } from "../../shared/types";
import { lcg, shuffleDeck } from "./cards";
import { normalizeInventory } from "./inventory";

// ===========================================================================
// Small id / money utilities (ported verbatim)
// ===========================================================================

export function shortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export function shortLongId(): string {
  return shortId() + shortId();
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function randomCollectibleKey(seed: number): string {
  const keys = ["SODA_CUP", "CHICKEN_WING", "FRIES", "DICE"];
  const r = lcg(seed)();
  return keys[Math.floor(r * keys.length)] ?? "SODA_CUP";
}

export function collectibleEmoji(key: string): string {
  const map: Record<string, string> = { SODA_CUP: "🥤", CHICKEN_WING: "🍗", FRIES: "🍟", DICE: "🎲" };
  return map[key] ?? "🎁";
}

// Bond interest accrues at 1.2^periods per elapsed minute (20% compounding/min).
export function applyBondAccrual(inv: Inventory, now: number): boolean {
  const b = inv.bond;
  const active = b?.active;
  if (!b || !active) return false;
  const last = Number(active.lastAccrualAt ?? active.startedAt ?? 0) || 0;
  if (!last || now <= last) return false;
  const periods = Math.floor((now - last) / 60_000);
  if (periods <= 0) return false;
  const factor = Math.pow(1.2, periods);
  active.value = roundMoney(Math.max(0, Number(active.value ?? 0) || 0) * factor);
  active.lastAccrualAt = last + periods * 60_000;
  return true;
}

// ===========================================================================
// Room feed: broadcast events + scoped chat (both stored on table state)
// ===========================================================================

export function appendBlackjackEvent(state: BlackjackTable, at: number, text: string, limit: number = BLACKJACK.EVENT_HISTORY_CAP): void {
  state.events.push({ id: shortLongId(), at, text });
  if (state.events.length > limit) {
    state.events = state.events.slice(state.events.length - limit);
  }
}

export function appendBlackjackChatMessage(
  state: BlackjackTable,
  input: { userId: string; username: string; text: string; at: number; prestigeLevel?: number; nameColor?: string | null },
  limit = BLACKJACK.CHAT_HISTORY_CAP,
): void {
  state.chat.push({
    id: shortLongId(),
    userId: input.userId,
    username: input.username,
    text: input.text,
    at: input.at,
    prestigeLevel: Number(input.prestigeLevel ?? 0) || 0,
    nameColor: (input.nameColor ?? null) as string | null,
  });
  if (state.chat.length > limit) {
    state.chat = state.chat.slice(state.chat.length - limit);
  }
}

function initialBlackjackRoomEvents(now: number, shoeCutCardAt: number) {
  return [
    {
      id: shortLongId(),
      at: now,
      text: `The deck has been shuffled. A new shoe card was placed at card number ${shoeCutCardAt}.`,
    },
  ];
}

// ===========================================================================
// Join codes (deterministic 8-char codes derived from table id + createdAt)
// ===========================================================================

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashString(input: string): number {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return h1 >>> 0;
}

export function blackjackJoinCodeFromTable(tableId: string, createdAt: number): string {
  const seed = `${String(tableId ?? "").slice(0, 48)}:${Math.max(0, Number(createdAt ?? 0) || 0)}`;
  let n = hashString(seed);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += JOIN_ALPHABET[n % JOIN_ALPHABET.length] ?? "X";
    n = Math.floor(n / JOIN_ALPHABET.length);
    if (n <= 0) n = hashString(`${seed}:${i}`);
  }
  return out;
}

export function normalizeBlackjackJoinCode(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

// ===========================================================================
// Seat normalization: keeps the legacy single-hand fields in sync with the
// active hand of the multi-hand (split) array.
// ===========================================================================

export function normalizeHandsForSeat(p: PlayerSeat | null): void {
  if (!p) return;
  if (typeof p.lastBetPlaced !== "number" || !Number.isFinite(p.lastBetPlaced)) p.lastBetPlaced = 0;
  if (typeof p.carryBetNext !== "number" || !Number.isFinite(p.carryBetNext)) p.carryBetNext = 0;
  if (!Array.isArray(p.hands) || p.hands.length === 0) {
    p.hands = [
      {
        bet: Number(p.bet ?? 0) || 0,
        nonces: [],
        perfectPairsWager: 0,
        perfectPairsNonce: null,
        perfectPairsSettled: false,
        cards: Array.isArray(p.cards) ? p.cards : [],
        bonusPoints: Number(p.bonusPoints ?? 0) || 0,
        stood: !!p.stood,
        busted: !!p.busted,
        turnEnded: !!p.turnEnded,
        doublePayoutArmed: !!p.doublePayoutArmed,
        usedThisRound: (p.usedThisRound ?? {}) as Record<string, boolean>,
        effects: [],
      },
    ];
    p.activeHandIndex = 0;
  }
  if (typeof p.activeHandIndex !== "number" || !Number.isFinite(p.activeHandIndex)) p.activeHandIndex = 0;
  if (p.activeHandIndex < 0) p.activeHandIndex = 0;
  if (p.activeHandIndex >= p.hands.length) p.activeHandIndex = p.hands.length - 1;

  for (const h of p.hands) {
    if (!h) continue;
    h.bet = Number(h.bet ?? 0) || 0;
    h.nonces = Array.isArray(h.nonces) ? h.nonces : [];
    h.perfectPairsWager = Number(h.perfectPairsWager ?? 0) || 0;
    h.perfectPairsNonce = h.perfectPairsNonce == null ? null : Number(h.perfectPairsNonce);
    if (!Number.isFinite(h.perfectPairsNonce)) h.perfectPairsNonce = null;
    h.perfectPairsSettled = !!h.perfectPairsSettled;
    h.cards = Array.isArray(h.cards) ? h.cards : [];
    h.bonusPoints = Number(h.bonusPoints ?? 0) || 0;
    h.stood = !!h.stood;
    h.busted = !!h.busted;
    h.turnEnded = !!h.turnEnded;
    h.doublePayoutArmed = !!h.doublePayoutArmed;
    h.usedThisRound = (h.usedThisRound ?? {}) as Record<string, boolean>;
    h.effects = Array.isArray(h.effects) ? h.effects : [];
  }

  const cur = p.hands[p.activeHandIndex] ?? p.hands[0];
  if (cur) {
    p.bet = cur.bet;
    p.cards = cur.cards;
    p.bonusPoints = cur.bonusPoints;
    p.stood = cur.stood;
    p.busted = cur.busted;
    p.turnEnded = cur.turnEnded;
    p.doublePayoutArmed = cur.doublePayoutArmed;
    p.usedThisRound = cur.usedThisRound;
  }
}

// ===========================================================================
// Shoe construction + table lifecycle
// ===========================================================================

function buildShoeState(seed: number) {
  const shoe = shuffleDeck(seed);
  const shoeInitialSize = shoe.length;
  const cutRng = lcg(seed ^ 1597334677);
  const cutMin = Math.max(40, Math.floor(shoeInitialSize * 0.65));
  const cutMax = Math.max(cutMin, Math.floor(shoeInitialSize * 0.82));
  const shoeCutCardAt = cutMin + Math.floor(cutRng() * (cutMax - cutMin + 1));
  return { shoe, shoeInitialSize, shoeCutCardAt };
}

export function newBlackjackTableState(input: { id: string; name: string; public: boolean; now: number }): BlackjackTable {
  const seed = Math.floor(input.now / 1000) ^ 2654435761;
  const { shoe, shoeInitialSize, shoeCutCardAt } = buildShoeState(seed);
  return {
    id: input.id,
    public: input.public,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    lastActivityAt: input.now,
    turnDurationMs: BLACKJACK.TURN_TIME_MS,
    disabledCategories: [],
    passwordEnabled: false,
    password: null,
    afkKickEnabled: true,
    chat: [],
    events: initialBlackjackRoomEvents(input.now, shoeCutCardAt),
    decorations: [],
    phase: "betting",
    round: 1,
    bettingEndsAt: input.now + BLACKJACK.BETTING_PHASE_MS,
    turnEndsAt: 0,
    dealerWindowEndsAt: 0,
    seats: Array.from({ length: BLACKJACK.SEATS }, () => null),
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

export function startBlackjackBetting(state: BlackjackTable, now: number): BlackjackTable {
  const s = state;
  s.phase = "betting";
  s.bettingEndsAt = now + BLACKJACK.BETTING_PHASE_MS;
  s.turnEndsAt = 0;
  s.dealerWindowEndsAt = 0;
  s.participants = [];
  s.turnIndex = 0;
  s.dealer = { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false, effects: [] };
  s.dealerBlackjack = false;
  s.peekByUserId = {};
  s.lastResults = s.lastResults ?? {};

  if (!Array.isArray(s.shoe) || s.shoe.length === 0 || s.shoeShufflePending) {
    const seed = Math.floor(now / 1000) ^ (s.round * 2654435761);
    const built = buildShoeState(seed);
    s.shoe = built.shoe;
    s.shoeInitialSize = built.shoeInitialSize;
    s.shoeCardsDealt = 0;
    s.shoeCutCardAt = built.shoeCutCardAt;
    s.shoeShufflePending = false;
    appendBlackjackEvent(
      s,
      now,
      `The deck has been shuffled. A new shoe card was placed at card number ${s.shoeCutCardAt}.`,
    );
  }

  for (let i = 0; i < s.seats.length; i += 1) {
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
        effects: [],
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

export function drawBlackjackCardFromShoe(s: BlackjackTable): number | null {
  const next = s.shoe.pop();
  if (typeof next === "number") {
    s.shoeCardsDealt = Math.max(0, Number(s.shoeCardsDealt ?? 0) || 0) + 1;
    const cutAt = Math.max(0, Number(s.shoeCutCardAt ?? 0) || 0);
    if (!s.shoeShufflePending && cutAt > 0 && s.shoeCardsDealt >= cutAt) {
      s.shoeShufflePending = true;
      appendBlackjackEvent(
        s,
        Date.now(),
        `The shoe card has been reached at card number ${cutAt}. The deck will be shuffled after this hand.`,
      );
    }
  }
  return typeof next === "number" ? next : null;
}

export function currentBlackjackTurnSeatIndex(s: BlackjackTable): number | null {
  return s.participants[s.turnIndex] ?? null;
}

export function blackjackTurnDurationMs(s: BlackjackTable): number {
  const v = Number(s.turnDurationMs ?? BLACKJACK.TURN_TIME_MS);
  return v === BLACKJACK.LONG_TURN_TIME_MS ? BLACKJACK.LONG_TURN_TIME_MS : BLACKJACK.TURN_TIME_MS;
}

export function advanceBlackjackTurn(state: BlackjackTable, now: number): BlackjackTable {
  const s = state;
  while (s.turnIndex < s.participants.length) {
    const seatIdx = s.participants[s.turnIndex]!;
    const p = s.seats[seatIdx];
    if (!p) {
      s.turnIndex += 1;
      continue;
    }
    normalizeHandsForSeat(p);
    const nextHandIdx = p.hands.findIndex((h) => !h.turnEnded);
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
