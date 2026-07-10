"server-only";

import { BLACKJACK, BOX_TIER } from "../../shared/constants";
import type {
  BlackjackTable as TableState,
  BlackjackHand,
  PlayerSeat,
  CardIndex,
  BlackjackInventory as Inventory,
  SettlementEntry,
  PlayerRoundResult,
  TableDecoration,
  PlacedCollectible,
  SpecialId,
} from "../../shared/types";
import { handTotal, cardFromIndex, encodeMagicCard, lcg } from "./cards";
import {
  SPECIALS,
  specialLabel,
  classifySpecial,
  normalizeInventory,
  invGet,
  invConsume,
  invAdd,
  rollBox,
} from "./inventory";
import {
  newBlackjackTableState,
  startBlackjackBetting,
  drawBlackjackCardFromShoe,
  currentBlackjackTurnSeatIndex,
  blackjackTurnDurationMs,
  advanceBlackjackTurn,
  normalizeHandsForSeat,
  appendBlackjackEvent,
  shortId,
  shortLongId,
  roundMoney,
  applyBondAccrual,
  randomCollectibleKey,
  collectibleEmoji,
} from "./lifecycle";

export { newBlackjackTableState, startBlackjackBetting };

export function tickTable(state: TableState, now: number): TableState {
  const s: TableState = { ...state };

  if (typeof s.turnDurationMs !== "number" || !Number.isFinite(s.turnDurationMs))
    s.turnDurationMs = BLACKJACK.TURN_TIME_MS;
  if (!Array.isArray(s.disabledCategories)) s.disabledCategories = [];
  s.passwordEnabled = !!s.passwordEnabled;
  if (s.passwordEnabled && typeof s.password !== "string") s.password = String(s.password ?? "");
  if (!s.passwordEnabled) s.password = null;
  if (typeof s.afkKickEnabled !== "boolean") s.afkKickEnabled = true;
  if (!Array.isArray(s.chat)) s.chat = [];
  if (!Array.isArray(s.events)) s.events = [];
  s.dealer.effects = Array.isArray(s.dealer?.effects) ? s.dealer.effects : [];
  if (!Array.isArray(s.shoe)) s.shoe = [];
  if (!Number.isFinite(Number(s.shoeInitialSize ?? 0))) s.shoeInitialSize = s.shoe.length;
  if (!Number.isFinite(Number(s.shoeCardsDealt ?? 0))) s.shoeCardsDealt = 0;
  if (!Number.isFinite(Number(s.shoeCutCardAt ?? 0))) s.shoeCutCardAt = 0;
  s.shoeShufflePending = !!s.shoeShufflePending;

  for (const p of s.seats) {
    if (!p) continue;
    p.inventory = normalizeInventory(p.inventory);
    normalizeHandsForSeat(p);
    if (applyBondAccrual(p.inventory, now)) {
      s.updatedAt = now;
    }
  }

  if (s.phase === "betting" && now >= s.bettingEndsAt) {
    return startRound(s, now);
  }

  if (s.phase === "player_turns") {
    const curSeatIdx = s.participants[s.turnIndex];
    if (curSeatIdx == null) return startBlackjackBetting(s, now);
    if (now >= s.turnEndsAt) {
      const seat = s.seats[curSeatIdx];
      if (seat) {
        normalizeHandsForSeat(seat);
        const hi = Math.max(
          0,
          Math.min(seat.activeHandIndex ?? 0, (seat.hands?.length ?? 1) - 1),
        );
        const h = seat.hands?.[hi];
        if (h) {
          h.stood = true;
          h.turnEnded = true;
        }
        seat.stood = true;
        seat.turnEnded = true;
        normalizeHandsForSeat(seat);
      }
      return advanceBlackjackTurn(s, now);
    }
  }

  if (s.phase === "dealer") {
    const dVal = handTotal(s.dealer.cards, s.dealer.bonusPoints).total;
    if (dVal < BLACKJACK.DEALER_HIT_BELOW) {
      const next = drawBlackjackCardFromShoe(s);
      if (next != null) s.dealer.cards.push(next);
      s.updatedAt = now;
      return s;
    }
    const dTotal = dVal;
    let anyLoseWithoutBust = false;
    for (const seatIdx of s.participants) {
      const p = s.seats[seatIdx];
      if (!p) continue;
      normalizeHandsForSeat(p);
      for (const h of p.hands ?? []) {
        const pTotal = handTotal(h.cards, h.bonusPoints).total;
        if (pTotal > 21) continue;
        if (dTotal > 21) continue;
        if (pTotal < dTotal) {
          anyLoseWithoutBust = true;
          break;
        }
      }
      if (anyLoseWithoutBust) break;
    }
    if (!anyLoseWithoutBust) {
      return settleRound(s, now);
    }
    s.phase = "dealer_window";
    s.dealerWindowEndsAt = now + BLACKJACK.DEALER_WINDOW_MS;
    s.updatedAt = now;
    return s;
  }

  if (s.phase === "dealer_window" && now >= s.dealerWindowEndsAt) {
    return settleRound(s, now);
  }

  if (s.phase === "settling") {
    if (now >= s.bettingEndsAt) return startBlackjackBetting(s, now);
  }

  return s;
}

function startRound(state: TableState, now: number): TableState {
  const s: TableState = { ...state };

  const participants: number[] = [];
  for (let i = 0; i < s.seats.length; i += 1) {
    const p = s.seats[i];
    if (!p) continue;
    if (p.bet > 0) {
      p.missedRounds = 0;
      participants.push(i);
    } else if (p.skipThisRound) {
      p.missedRounds = 0;
    } else {
      p.missedRounds += 1;
    }
  }

  if (s.afkKickEnabled) {
    for (let i = 0; i < s.seats.length; i += 1) {
      const p = s.seats[i];
      if (!p) continue;
      if (p.missedRounds >= BLACKJACK.AFK_KICK_MISSED_ROUNDS) {
        p.inventory = normalizeInventory(p.inventory);
        p.inventory.collectibles = p.inventory.collectibles ?? {
          owned: {},
          figurines: [],
          placed: [],
        };
        p.inventory.collectibles.placed = Array.isArray(p.inventory.collectibles.placed)
          ? p.inventory.collectibles.placed
          : [];
        p.inventory.collectibles.placed = syncOwnedDecorationsIntoPlacedCollectibles(
          s,
          p.userId,
          p.inventory.collectibles.placed,
          now,
        );
        p.inventory = returnPlacedCollectiblesToInventory(p.inventory, s.decorations, now);
        s.evictedInventories = s.evictedInventories ?? [];
        s.evictedInventories.push({ userId: p.userId, inventory: p.inventory });
        s.seats[i] = null;
        removeUserBlackjackDecorations(s, p.userId);
      }
    }
  }

  if (participants.length === 0) {
    return startBlackjackBetting(s, now);
  }

  s.participants = participants;
  s.turnIndex = 0;
  s.phase = "player_turns";
  s.turnEndsAt = now + blackjackTurnDurationMs(s);
  s.peekByUserId = {};
  s.dealerBlackjack = false;
  s.dealer = {
    cards: [],
    bonusPoints: 0,
    secondChanceArmed: false,
    secondChanceUsed: false,
    effects: [],
  };

  for (const idx of participants) {
    const p = s.seats[idx]!;
    const bet = Number(p.hands?.[0]?.bet ?? p.bet ?? 0) || 0;
    const prevNonces = Array.isArray(p.hands?.[0]?.nonces)
      ? (p.hands[0]!.nonces as number[])
      : [];
    const prevDoublePayout = !!(p.hands?.[0]?.doublePayoutArmed ?? p.doublePayoutArmed);
    const prevPPWager = Number(p.hands?.[0]?.perfectPairsWager ?? 0) || 0;
    const prevPPNonce = p.hands?.[0]?.perfectPairsNonce ?? null;
    p.hands = [
      {
        bet,
        nonces: [...prevNonces],
        perfectPairsWager: prevPPWager,
        perfectPairsNonce: prevPPNonce,
        perfectPairsSettled: false,
        cards: [],
        bonusPoints: 0,
        stood: false,
        busted: false,
        turnEnded: false,
        doublePayoutArmed: prevDoublePayout,
        usedThisRound: {},
        effects: [],
      },
    ];
    p.activeHandIndex = 0;
    p.bjProtected = !!p.bjProtected;
    p.extendUsedThisTurn = false;
    const a = drawBlackjackCardFromShoe(s);
    const b = drawBlackjackCardFromShoe(s);
    if (a != null) p.hands[0]!.cards.push(a);
    if (b != null) p.hands[0]!.cards.push(b);
    normalizeHandsForSeat(p);
  }
  const d1 = drawBlackjackCardFromShoe(s);
  const d2 = drawBlackjackCardFromShoe(s);
  if (d1 != null) s.dealer.cards.push(d1);
  if (d2 != null) s.dealer.cards.push(d2);

  const dBJ =
    handTotal(s.dealer.cards, s.dealer.bonusPoints).total === 21 &&
    s.dealer.cards.length === 2;
  if (dBJ) {
    s.dealerBlackjack = true;
    return settleRound(s, now);
  }

  for (const idx of participants) {
    const p = s.seats[idx]!;
    const h = p.hands?.[0];
    if (h && handTotal(h.cards, h.bonusPoints).total === 21) {
      h.turnEnded = true;
      h.stood = true;
      normalizeHandsForSeat(p);
    }
  }
  return advanceBlackjackTurn(s, now);
}

export function applyBet(
  state: TableState,
  userId: string,
  amount: number,
  now: number,
  betNonce?: number | null,
  allIn?: boolean,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "Betting is closed." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  if ((p.hands?.[0]?.nonces?.length ?? 0) > 0 && (p.hands?.[0]?.bet ?? 0) > 0) {
    return { state: s, error: "Bet already placed. Clear bet before placing again." };
  }
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return { state: s, error: "Invalid bet amount." };
  p.hands[0]!.bet = Math.round(a * 100) / 100;
  p.allIn = !!allIn;
  if (betNonce == null) {
    p.hands[0]!.nonces = [];
  } else {
    const n = Number(betNonce);
    if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing." };
    p.hands[0]!.nonces = [n];
  }
  p.activeHandIndex = 0;
  normalizeHandsForSeat(p);
  p.lastBetPlaced = p.hands[0]!.bet;
  p.skipThisRound = false;
  p.lastSeenAt = now;
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applyPerfectPairsBet(
  state: TableState,
  userId: string,
  wager: number,
  now: number,
  betNonce?: number | null,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "Betting is closed." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  const w = Math.round(Number(wager ?? 0) * 100) / 100;
  if (!Number.isFinite(w) || w <= 0) return { state: s, error: "Invalid side bet amount." };
  if (betNonce == null) return { state: s, error: "Wallet nonce missing." };
  const n = Number(betNonce);
  if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing." };
  const h0 = p.hands[0]!;
  if (h0.perfectPairsNonce != null && (h0.perfectPairsWager ?? 0) > 0) {
    return { state: s, error: "Perfect Pairs bet already placed." };
  }
  h0.perfectPairsWager = w;
  h0.perfectPairsNonce = n;
  h0.perfectPairsSettled = false;
  normalizeHandsForSeat(p);
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applyClearPerfectPairsBet(
  state: TableState,
  userId: string,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only clear bets during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  const h0 = p.hands[0]!;
  h0.perfectPairsWager = 0;
  h0.perfectPairsNonce = null;
  h0.perfectPairsSettled = false;
  normalizeHandsForSeat(p);
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applySkip(
  state: TableState,
  userId: string,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only skip during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  p.hands[0]!.bet = 0;
  p.hands[0]!.nonces = [];
  p.allIn = false;
  p.activeHandIndex = 0;
  normalizeHandsForSeat(p);
  p.lastBetPlaced = 0;
  p.carryBetNext = 0;
  p.skipThisRound = true;
  p.lastSeenAt = now;
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applyClearBet(
  state: TableState,
  userId: string,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only clear bets during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  p.hands[0]!.bet = 0;
  p.hands[0]!.nonces = [];
  p.allIn = false;
  p.activeHandIndex = 0;
  normalizeHandsForSeat(p);
  p.lastBetPlaced = 0;
  p.carryBetNext = 0;
  p.skipThisRound = false;
  p.lastSeenAt = now;
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applyPlayerAction(
  state: TableState,
  userId: string,
  action: { type: "hit" | "stand" | "double_down" | "split"; betNonce?: number | null },
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "Not in player turn phase." };
  const turnSeatIdx = currentBlackjackTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  normalizeHandsForSeat(p);
  const h = p.hands[p.activeHandIndex]!;
  if (p.userId !== userId) return { state: s, error: "Not your turn." };
  if (action.type === "hit" && h.busted)
    return { state: s, error: "You are busted. Play a save card or stand." };

  if (action.type === "hit") {
    const c = drawBlackjackCardFromShoe(s);
    if (c != null) h.cards.push(c);
    s.lastActivityAt = now;
    s.turnEndsAt = now + blackjackTurnDurationMs(s);
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) {
      h.busted = true;
      normalizeHandsForSeat(p);
      s.updatedAt = now;
      return { state: s };
    }
    if (t === 21) {
      h.turnEnded = true;
      h.stood = true;
      normalizeHandsForSeat(p);
      return { state: advanceBlackjackTurn(s, now) };
    }
    normalizeHandsForSeat(p);
    s.updatedAt = now;
    return { state: s };
  }

  if (action.type === "double_down") {
    if (h.busted) return { state: s, error: "You are busted." };
    if (h.cards.length !== 2) return { state: s, error: "Double down only on first two cards." };
    if (!(h.bet > 0)) return { state: s, error: "No bet placed." };
    if (action.betNonce == null) return { state: s, error: "Wallet nonce missing." };
    const n = Number(action.betNonce);
    if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing." };
    h.bet = Math.round(h.bet * 2 * 100) / 100;
    h.nonces = [...(h.nonces ?? []), n];
    const c = drawBlackjackCardFromShoe(s);
    if (c != null) h.cards.push(c);
    s.lastActivityAt = now;
    s.turnEndsAt = now + blackjackTurnDurationMs(s);
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) h.busted = true;
    h.turnEnded = true;
    h.stood = true;
    normalizeHandsForSeat(p);
    return { state: advanceBlackjackTurn(s, now) };
  }

  if (action.type === "split") {
    if (h.busted) return { state: s, error: "You are busted." };
    if (h.turnEnded) return { state: s, error: "Hand already ended." };
    if (h.cards.length !== 2) return { state: s, error: "Split only with exactly 2 cards." };
    if ((p.hands?.length ?? 1) >= BLACKJACK.MAX_HANDS_PER_SEAT)
      return { state: s, error: "Max splits reached." };
    if (action.betNonce == null) return { state: s, error: "Wallet nonce missing." };
    const n = Number(action.betNonce);
    if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing." };

    const c1 = h.cards[0]!;
    const c2 = h.cards[1]!;
    const ranksMatch = (() => {
      try {
        return cardFromIndex(c1).rank === cardFromIndex(c2).rank;
      } catch {
        return false;
      }
    })();
    const canFreeSplit = invGet(p.inventory, "FREE_SPLIT") > 0;
    if (!ranksMatch && !canFreeSplit)
      return { state: s, error: "Split requires matching ranks (or Free Split)." };
    if (!ranksMatch && canFreeSplit) {
      invConsume(p.inventory, "FREE_SPLIT");
    }

    const newHandA: BlackjackHand = {
      bet: h.bet,
      nonces: [...(h.nonces ?? [])],
      perfectPairsWager: h.perfectPairsWager,
      perfectPairsNonce: h.perfectPairsNonce,
      perfectPairsSettled: h.perfectPairsSettled,
      cards: [c1],
      bonusPoints: 0,
      stood: false,
      busted: false,
      turnEnded: false,
      doublePayoutArmed: false,
      usedThisRound: {},
      effects: [],
    };
    const newHandB: BlackjackHand = {
      bet: h.bet,
      nonces: [n],
      perfectPairsWager: h.perfectPairsWager,
      perfectPairsNonce: h.perfectPairsNonce,
      perfectPairsSettled: h.perfectPairsSettled,
      cards: [c2],
      bonusPoints: 0,
      stood: false,
      busted: false,
      turnEnded: false,
      doublePayoutArmed: false,
      usedThisRound: {},
      effects: [],
    };

    const hands = p.hands ?? [];
    hands.splice(p.activeHandIndex, 1, newHandA, newHandB);
    p.hands = hands;

    const a = drawBlackjackCardFromShoe(s);
    const b = drawBlackjackCardFromShoe(s);
    if (a != null) newHandA.cards.push(a);
    if (b != null) newHandB.cards.push(b);

    const ta = handTotal(newHandA.cards, newHandA.bonusPoints).total;
    if (ta === 21) {
      newHandA.turnEnded = true;
      newHandA.stood = true;
    } else if (ta > 21) {
      newHandA.busted = true;
    }
    const tb = handTotal(newHandB.cards, newHandB.bonusPoints).total;
    if (tb === 21) {
      newHandB.turnEnded = true;
      newHandB.stood = true;
    } else if (tb > 21) {
      newHandB.busted = true;
    }

    p.activeHandIndex = Math.max(0, p.hands.findIndex((hh) => !hh?.turnEnded));
    if (p.activeHandIndex < 0) p.activeHandIndex = 0;
    normalizeHandsForSeat(p);
    s.lastActivityAt = now;
    s.turnEndsAt = now + blackjackTurnDurationMs(s);
    s.updatedAt = now;
    return { state: s };
  }

  if (action.type === "stand") {
    h.turnEnded = true;
    h.stood = true;
    s.lastActivityAt = now;
    normalizeHandsForSeat(p);
    return { state: advanceBlackjackTurn(s, now) };
  }

  return { state: s, error: "Unknown action." };
}

export function applyVoteSkipTurn(
  state: TableState,
  userId: string,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "No active turn timer." };
  const turnSeatIdx = currentBlackjackTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  if (p.userId !== userId) return { state: s, error: "Only the current player can skip." };
  normalizeHandsForSeat(p);
  const h = p.hands[p.activeHandIndex]!;
  h.turnEnded = true;
  h.stood = true;
  normalizeHandsForSeat(p);
  s.lastActivityAt = now;
  return { state: advanceBlackjackTurn(s, now) };
}

export function applyExtendTurnTimer(
  state: TableState,
  userId: string,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "No active turn timer." };
  const turnSeatIdx = currentBlackjackTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  if (p.userId !== userId) return { state: s, error: "Not your turn." };
  if (p.extendUsedThisTurn) return { state: s, error: "Extend already used this turn." };
  p.extendUsedThisTurn = true;
  s.turnEndsAt = Math.max(s.turnEndsAt, now) + BLACKJACK.EXTENSION_TIME_MS;
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

const SINGLE_USE_PER_ROUND: Set<SpecialId> = new Set([
  "PEEK_NEXT",
  "SWAP_ONE",
  "DOUBLE_PAYOUT",
  "DEALER_SECOND_CHANCE",
  "BJ_PROTECTOR",
  "MYTHIC_COPY_HANDS",
]);

export function applySpecial(
  state: TableState,
  userId: string,
  input: { id: SpecialId; targetUserId?: string | null; cardIndex?: number | null },
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated." };
  const actor = s.seats[seatIdx]!;
  actor.inventory = normalizeInventory(actor.inventory);
  normalizeHandsForSeat(actor);
  const def = SPECIALS[input.id];
  if (!def) return { state: s, error: "Unknown special." };
  const cat = classifySpecial(input.id);
  if ((s.disabledCategories ?? []).includes(cat)) {
    return { state: s, error: "That powerup category is disabled." };
  }
  if (invGet(actor.inventory, input.id) <= 0) return { state: s, error: "No charges left." };
  if (SINGLE_USE_PER_ROUND.has(input.id) && actor.usedThisRound?.[input.id]) {
    return { state: s, error: "Already used this round." };
  }

  const currentTurnSeatIdx = currentBlackjackTurnSeatIndex(s);
  const isOwnTurn =
    s.phase === "player_turns" &&
    currentTurnSeatIdx != null &&
    s.seats[currentTurnSeatIdx]?.userId === userId;
  const isBeforeEndOfRound =
    s.phase === "player_turns" || s.phase === "dealer" || s.phase === "dealer_window";
  const isBetting = s.phase === "betting";

  if (def.timing === "betting" && !isBetting) return { state: s, error: "Only usable during betting." };
  if (def.timing === "own_turn" && !isOwnTurn)
    return { state: s, error: "Only usable on your turn." };
  if (def.timing === "dealer_window" && s.phase !== "dealer_window")
    return { state: s, error: "Only usable after dealer stands." };
  if (def.timing === "anytime" && !isBeforeEndOfRound)
    return { state: s, error: "Only usable before end of round." };

  let targetSeat: PlayerSeat | null = null;
  let targetSeatIdx: number | null = null;
  if (def.target === "self") {
    targetSeat = actor;
    targetSeatIdx = seatIdx;
  } else if (def.target === "dealer") {
    targetSeat = null;
    targetSeatIdx = null;
  } else {
    const tuid = input.targetUserId ?? userId;
    if (tuid === "-1") {
      targetSeat = null;
      targetSeatIdx = null;
    } else {
      const idx = s.seats.findIndex((p) => p?.userId === tuid);
      if (idx < 0) return { state: s, error: "Target not seated." };
      targetSeat = s.seats[idx]!;
      targetSeatIdx = idx;
    }
  }

  if (input.id === "ADD2_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += 2;
    if (handTotal(h.cards, h.bonusPoints).total > 21) h.busted = true;
  } else if (input.id === "ADD1_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += 1;
    if (handTotal(h.cards, h.bonusPoints).total > 21) h.busted = true;
  } else if (input.id === "PEEK_NEXT") {
    const next = s.shoe[s.shoe.length - 1];
    s.peekByUserId[userId] = typeof next === "number" ? next : null;
  } else if (input.id === "BJ_PROTECTOR") {
    actor.bjProtected = true;
  } else if (input.id === "FREE_SPLIT") {
    return { state: s, error: "This powerup is consumed when you Split." };
  } else if (input.id === "SWAP_ONE") {
    const h = actor.hands[actor.activeHandIndex]!;
    if (h.cards.length === 0) return { state: s, error: "No cards to swap." };
    const next = drawBlackjackCardFromShoe(s);
    if (next == null) return { state: s, error: "Shoe empty." };
    h.cards[h.cards.length - 1] = next;
    if (handTotal(h.cards, h.bonusPoints).total > 21) h.busted = true;
  } else if (input.id === "DOUBLE_PAYOUT") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.doublePayoutArmed = true;
  } else if (input.id === "REMOVE_RANDOM_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    if (!h.cards.length) return { state: s, error: "No cards to remove." };
    const idx = Math.floor(
      lcg(Math.floor(now / 1000) ^ (seatIdx * 1337) ^ (s.round * 4242))() * h.cards.length,
    );
    h.cards.splice(Math.max(0, Math.min(h.cards.length - 1, idx)), 1);
    if (handTotal(h.cards, h.bonusPoints).total <= 21) h.busted = false;
  } else if (input.id === "REMOVE_CARD_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    if (!h.cards.length) return { state: s, error: "No cards to remove." };
    const idx = Number(input.cardIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= h.cards.length)
      return { state: s, error: "Choose a card to remove." };
    h.cards.splice(idx, 1);
    if (handTotal(h.cards, h.bonusPoints).total <= 21) h.busted = false;
  } else if (input.id === "ADD2_DEALER") {
    s.dealer.bonusPoints += 2;
  } else if (input.id === "DEALER_SECOND_CHANCE") {
    s.dealer.secondChanceArmed = true;
  } else if (input.id === "ADD2_TARGET") {
    if (!targetSeat) {
      s.dealer.bonusPoints += 2;
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.bonusPoints += 2;
      if (handTotal(th.cards, th.bonusPoints).total > 21) th.busted = true;
    }
  } else if (input.id === "FORCE_HIT_TARGET") {
    const c = drawBlackjackCardFromShoe(s);
    if (c == null) return { state: s, error: "Shoe empty." };
    if (!targetSeat) {
      s.dealer.cards.push(c);
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.cards.push(c);
      if (handTotal(th.cards, th.bonusPoints).total > 21) th.busted = true;
    }
  } else if (input.id === "ADD1_MAGIC" || input.id === "ADD2_MAGIC") {
    const count = input.id === "ADD1_MAGIC" ? 1 : 2;
    const rand = lcg(Math.floor(now / 1000) ^ (seatIdx * 1337) ^ (s.round * 4242));
    const pull = () => Math.floor(rand() * 52);
    if (!targetSeat) {
      for (let i = 0; i < count; i += 1) s.dealer.cards.push(pull());
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      for (let i = 0; i < count; i += 1) th.cards.push(pull());
      if (handTotal(th.cards, th.bonusPoints).total > 21) th.busted = true;
    }
  } else if (
    input.id === "MAGIC_ACE" ||
    input.id === "MAGIC_KING" ||
    input.id === "MAGIC_QUEEN" ||
    input.id === "MAGIC_JACK" ||
    input.id === "MAGIC_JOKER"
  ) {
    const rank = (input.id === "MAGIC_ACE"
      ? "A"
      : input.id === "MAGIC_KING"
        ? "K"
        : input.id === "MAGIC_QUEEN"
          ? "Q"
          : input.id === "MAGIC_JACK"
            ? "J"
            : "JOKER") as "A" | "K" | "Q" | "J" | "JOKER";
    const suitIdx = Math.floor(
      lcg(Math.floor(now / 1000) ^ (seatIdx * 1337) ^ (s.round * 4242))() * 4,
    );
    const magicCard = encodeMagicCard(rank, suitIdx);
    if (!targetSeat) {
      s.dealer.cards.push(magicCard);
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.cards.push(magicCard);
      if (handTotal(th.cards, th.bonusPoints).total > 21) th.busted = true;
    }
  } else if (input.id === "MYTHIC_COPY_HANDS") {
    if (!targetSeat) return { state: s, error: "Choose a player to copy." };
    normalizeHandsForSeat(targetSeat);
    const copyFrom = targetSeat.hands[targetSeat.activeHandIndex]!;
    for (const other of s.seats) {
      if (!other) continue;
      normalizeHandsForSeat(other);
      other.hands = [
        {
          bet: other.hands?.[0]?.bet ?? other.bet ?? 0,
          nonces: [],
          perfectPairsWager: other.hands?.[0]?.perfectPairsWager ?? 0,
          perfectPairsNonce: other.hands?.[0]?.perfectPairsNonce ?? null,
          perfectPairsSettled: false,
          cards: [...copyFrom.cards],
          bonusPoints: copyFrom.bonusPoints,
          stood: false,
          busted: false,
          turnEnded: false,
          doublePayoutArmed: false,
          usedThisRound: {},
          effects: [],
        },
      ];
      other.activeHandIndex = 0;
      normalizeHandsForSeat(other);
    }
  } else if (
    input.id === "SUB1_SELF" ||
    input.id === "SUB2_SELF" ||
    input.id === "SUB5_SELF" ||
    input.id === "SUB10_SELF"
  ) {
    const delta =
      input.id === "SUB1_SELF"
        ? -1
        : input.id === "SUB2_SELF"
          ? -2
          : input.id === "SUB5_SELF"
            ? -5
            : -10;
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += delta;
    if (handTotal(h.cards, h.bonusPoints).total <= 21) h.busted = false;
  }

  if (SINGLE_USE_PER_ROUND.has(input.id)) (actor.usedThisRound as Record<string, boolean>)[input.id] = true;
  if (!invConsume(actor.inventory, input.id)) return { state: s, error: "No charges left." };

  const isDealerTarget = !targetSeat;
  const targetLabel =
    def.target === "self"
      ? ""
      : isDealerTarget
        ? " on Dealer"
        : targetSeat && targetSeat.userId === actor.userId
          ? ""
          : ` on ${targetSeat?.username ?? "player"}`;
  appendBlackjackEvent(s, now, `${actor.username} used ${specialLabel(input.id)}${targetLabel}`, 60);

  const effect = {
    id: shortLongId(),
    at: now,
    fromUserId: actor.userId,
    fromUsername: actor.username,
    powerupId: input.id,
    powerupName: specialLabel(input.id),
  };
  if (input.id === "MYTHIC_COPY_HANDS") {
    for (const other of s.seats) {
      if (!other) continue;
      normalizeHandsForSeat(other);
      const th = other.hands?.[other.activeHandIndex ?? 0];
      if (th) {
        th.effects = Array.isArray(th.effects) ? th.effects : [];
        th.effects.push(effect);
        if (th.effects.length > BLACKJACK.EFFECT_HISTORY_CAP)
          th.effects = th.effects.slice(th.effects.length - BLACKJACK.EFFECT_HISTORY_CAP);
      }
    }
  } else if (isDealerTarget) {
    s.dealer.effects = Array.isArray(s.dealer.effects) ? s.dealer.effects : [];
    s.dealer.effects.push(effect);
    if (s.dealer.effects.length > BLACKJACK.EFFECT_HISTORY_CAP)
      s.dealer.effects = s.dealer.effects.slice(-BLACKJACK.EFFECT_HISTORY_CAP);
  } else if (targetSeat) {
    normalizeHandsForSeat(targetSeat);
    const th = targetSeat.hands?.[targetSeat.activeHandIndex ?? 0];
    if (th) {
      th.effects = Array.isArray(th.effects) ? th.effects : [];
      th.effects.push(effect);
      if (th.effects.length > BLACKJACK.EFFECT_HISTORY_CAP)
        th.effects = th.effects.slice(th.effects.length - BLACKJACK.EFFECT_HISTORY_CAP);
    }
  }

  actor.lastSeenAt = now;
  s.lastActivityAt = now;
  if (isOwnTurn) s.turnEndsAt = now + blackjackTurnDurationMs(s);

  normalizeHandsForSeat(actor);
  s.updatedAt = now;
  return { state: s };
}

function settleRound(state: TableState, now: number): TableState {
  const s: TableState = { ...state };
  const isDealerBJ = !!s.dealerBlackjack;
  const dBase = handTotal(s.dealer.cards, s.dealer.bonusPoints).total;
  let dTotal = isDealerBJ ? 21 : dBase;
  if (!isDealerBJ && dTotal > 21 && s.dealer.secondChanceArmed && !s.dealer.secondChanceUsed) {
    dTotal -= 10;
    s.dealer.secondChanceUsed = true;
  }

  const results: Record<
    string,
    {
      outcome: string;
      multiplier: number;
      wager: number;
      settlements: SettlementEntry[];
      ppSettlements: SettlementEntry[];
    }
  > = {};
  let mythicDropAny = false;

  for (const seatIdx of s.participants) {
    const p = s.seats[seatIdx];
    if (!p) continue;
    p.inventory = normalizeInventory(p.inventory);
    normalizeHandsForSeat(p);

    let bestMult = 0;
    let bestOutcome = "";
    let totalWager = 0;
    let totalReturn = 0;
    const settlements: SettlementEntry[] = [];
    const ppSettlements: SettlementEntry[] = [];
    let anySevenCardWinOrPush = false;
    let rareBoxesEarned = 0;
    let collectibleBoxesEarned = 0;

    for (const h of p.hands ?? []) {
      const pTotal = handTotal(h.cards, h.bonusPoints).total;
      let mult = 0;
      let outcome = "";
      const pBJ = pTotal === 21 && h.cards.length === 2;
      const dBJ = dTotal === 21 && s.dealer.cards.length === 2;

      if (isDealerBJ) {
        if (p.bjProtected) {
          mult = 1;
          outcome = "Dealer blackjack (protected)";
        } else {
          mult = 0;
          outcome = "Dealer blackjack";
        }
      } else if (pTotal > 21) {
        mult = 0;
        outcome = `Bust (${pTotal})`;
      } else if (dBJ && pBJ) {
        mult = 1;
        outcome = "Push (both blackjack)";
      } else if (
        !isDealerBJ &&
        pTotal === 21 &&
        h.cards.length === 3 &&
        h.cards.every((ci) => cardFromIndex(ci).rank === "7")
      ) {
        mult = BLACKJACK.TRIPLE_SEVEN_PAYOUT_MULT;
        outcome = "Triple 7 (7:1)";
      } else if (pBJ) {
        mult = BLACKJACK.BLACKJACK_PAYOUT_MULT;
        outcome = "Blackjack (2:1)";
        const pl = Number(p.prestigeLevel ?? 0) || 0;
        if (pl > 0) {
          const bonus = 2 * pl;
          mult += bonus;
          outcome += ` +${bonus.toFixed(0)}x (prestige)`;
        }
      } else if (dTotal > 21) {
        mult = BLACKJACK.DEALER_BUST_PAYOUT_MULT;
        outcome = `Dealer bust (${dTotal})`;
      } else if (pTotal > dTotal) {
        mult = BLACKJACK.NORMAL_WIN_PAYOUT_MULT;
        outcome = `${pTotal} > ${dTotal}`;
      } else if (pTotal < dTotal) {
        mult = 0;
        outcome = `${pTotal} < ${dTotal}`;
      } else {
        mult = 1;
        outcome = `Push (${pTotal})`;
      }

      if (pBJ) rareBoxesEarned += 1;
      for (const ci of h.cards ?? []) {
        if (cardFromIndex(ci).rank === "JOKER") rareBoxesEarned += 1;
      }

      const isTriple7 =
        !isDealerBJ &&
        pTotal === 21 &&
        h.cards.length === 3 &&
        h.cards.every((ci) => cardFromIndex(ci).rank === "7");
      const isSevenPlus = h.cards.length >= 7 && mult >= 1 && pTotal <= 21;
      if (pBJ || isTriple7 || isSevenPlus) collectibleBoxesEarned += 1;

      if (!isDealerBJ && pTotal <= 21) {
        const cards = h.cards.length;
        if (cards >= 6 && mult === 0) {
          mult = 1;
          outcome = "Push (6+ cards)";
        }
        if (mult > 1 && cards >= 5) {
          const bonus = 2 * (cards - 4);
          mult += bonus;
          outcome += ` +${bonus.toFixed(0)}x (cards)`;
        }
        if (mult > 1 && cards >= 5) {
          const pl = Number(p.prestigeLevel ?? 0) || 0;
          if (pl > 0) {
            const bonus = 2 * pl;
            mult += bonus;
            outcome += ` +${bonus.toFixed(0)}x (prestige)`;
          }
        }
        if (mult > 1 && cards >= 5 && pTotal === 21) {
          mult += 2;
          outcome += " +2x (21)";
        }
        if (cards >= 7 && mult >= 1) anySevenCardWinOrPush = true;
      }

      if (h.doublePayoutArmed && mult > 1) mult *= 2;

      if (
        !h.perfectPairsSettled &&
        (h.perfectPairsWager ?? 0) > 0 &&
        h.perfectPairsNonce != null &&
        Number.isFinite(Number(h.perfectPairsNonce)) &&
        Number(h.perfectPairsNonce) >= 0
      ) {
        if (h.cards.length >= 2) {
          const ppm = perfectPairsMultiplierInternal(h.cards[0]!, h.cards[1]!);
          const out = ppm > 0 ? `Perfect Pairs x${ppm.toFixed(0)}` : "Perfect Pairs lose";
          ppSettlements.push({
            nonce: Number(h.perfectPairsNonce),
            wager: h.perfectPairsWager,
            multiplier: ppm,
            outcome: out,
          });
          h.perfectPairsSettled = true;
        }
      }

      const nonces = Array.isArray(h.nonces)
        ? h.nonces.filter((x) => Number.isFinite(x) && x >= 0)
        : [];
      const parts = Math.max(1, nonces.length);
      const partWager = parts > 0 ? (Number(h.bet ?? 0) || 0) / parts : 0;
      for (const nonce of nonces) {
        settlements.push({ nonce, wager: partWager, multiplier: mult, outcome });
      }

      totalWager += Number(h.bet ?? 0) || 0;
      totalReturn += (Number(h.bet ?? 0) || 0) * mult;

      if (mult > bestMult) {
        bestMult = mult;
        bestOutcome = outcome;
      }
    }

    const mAll = totalWager > 0 ? totalReturn / totalWager : 0;
    const playedAllIn = !!p.allIn;

    if (mAll > 2) rareBoxesEarned += 1;

    if (playedAllIn) {
      p.carryBetNext = Math.round(totalReturn * 100) / 100;
    } else if (mAll > 1) {
      p.carryBetNext = Number(p.lastBetPlaced ?? p.hands?.[0]?.bet ?? 0) || 0;
    } else {
      p.carryBetNext = 0;
    }

    p.inventory.bonusPoints = Math.max(0, Math.floor(Number(p.inventory.bonusPoints ?? 0) || 0));
    p.inventory.allInWinStreak = Math.max(0, Math.floor(Number(p.inventory.allInWinStreak ?? 0) || 0));
    if (playedAllIn) {
      p.inventory.bonusPoints += 1;
      const isWin = mAll > 1;
      const isPush = mAll === 1;
      if (isWin) {
        p.inventory.allInWinStreak += 1;
        p.inventory.bonusPoints += Math.max(0, p.inventory.allInWinStreak - 1);
      } else if (!isPush) {
        p.inventory.allInWinStreak = 0;
      }
    } else {
      p.inventory.allInWinStreak = 0;
    }

    mythicDropAny = mythicDropAny || anySevenCardWinOrPush;

    p.inventory.handsPlayed = Number(p.inventory.handsPlayed ?? 0) + 1;
    if (p.inventory.handsPlayed % BLACKJACK.NORMAL_BOX_EVERY_HANDS === 0) {
      const seed =
        Math.floor(now / 1000) ^ (s.round * 1103515245) ^ (Number(p.userId) * 2654435761);
      const box = rollBox(BOX_TIER.NORMAL, seed);
      p.inventory.boxes = p.inventory.boxes ?? [];
      p.inventory.boxes.push({
        id: shortId(),
        tier: BOX_TIER.NORMAL,
        awardedAt: now,
        opened: false,
        contents: box,
      });
    }

    if (rareBoxesEarned > 0) {
      p.inventory.boxes = p.inventory.boxes ?? [];
      for (let i = 0; i < rareBoxesEarned; i += 1) {
        const seed =
          Math.floor(now / 1000) ^
          (s.round * 1597334677) ^
          (Number(p.userId) * 2654435761) ^
          (i * 97531);
        const box = rollBox(BOX_TIER.RARE, seed);
        p.inventory.boxes.push({
          id: shortId(),
          tier: BOX_TIER.RARE,
          awardedAt: now,
          opened: false,
          contents: box,
        });
      }
    }

    if (collectibleBoxesEarned > 0) {
      p.inventory.collectibles = p.inventory.collectibles ?? {
        owned: {},
        figurines: [],
        placed: [],
      };
      const owned = p.inventory.collectibles.owned ?? {};
      for (let i = 0; i < collectibleBoxesEarned; i += 1) {
        const key = randomCollectibleKey(
          ((now ^ (s.round * 1103515245) ^ (Number(p.userId) * 2654435761) ^ i) >>> 0),
        );
        owned[key] = Math.max(0, Math.floor(Number(owned[key] ?? 0) || 0) + 1);
        appendBlackjackEvent(s, now, `${p.username} found a collectible: ${collectibleEmoji(key)}`);
      }
      p.inventory.collectibles.owned = owned;
      s.updatedAt = now;
    }

    results[p.userId] = {
      outcome: bestOutcome,
      multiplier: mAll,
      wager: totalWager,
      settlements,
      ppSettlements,
    };
  }

  if (mythicDropAny) {
    for (const seatIdx of s.participants) {
      const p = s.seats[seatIdx];
      if (!p) continue;
      p.inventory = normalizeInventory(p.inventory);
      const seed =
        Math.floor(now / 1000) ^ (s.round * 2246822519) ^ (Number(p.userId) * 3266489917);
      const box = rollBox(BOX_TIER.MYTHIC, seed);
      p.inventory.boxes = p.inventory.boxes ?? [];
      p.inventory.boxes.push({
        id: shortId(),
        tier: BOX_TIER.MYTHIC,
        awardedAt: now,
        opened: false,
        contents: box,
      });
    }
  }

  s.lastResults = results;
  s.phase = "settling";
  s.bettingEndsAt = now + BLACKJACK.SETTLING_MS;
  s.dealerWindowEndsAt = 0;
  s.updatedAt = now;
  return s;
}

function perfectPairsMultiplierInternal(cardA: CardIndex, cardB: CardIndex): number {
  try {
    const a = cardFromIndex(cardA);
    const b = cardFromIndex(cardB);
    if (a.rank !== b.rank) return 0;
    const aRed = a.suit === "♥" || a.suit === "♦";
    const bRed = b.suit === "♥" || b.suit === "♦";
    if (a.suit === b.suit) return BLACKJACK.PERFECT_PAIRS_SAME_SUIT;
    if (aRed === bRed) return BLACKJACK.PERFECT_PAIRS_SAME_COLOR;
    return BLACKJACK.PERFECT_PAIRS_SAME_RANK;
  } catch {
    return 0;
  }
}

function syncOwnedDecorationsIntoPlacedCollectibles(
  state: TableState,
  userId: string,
  placed: (TableDecoration | PlacedCollectible)[] | null | undefined,
  now: number,
): TableDecoration[] {
  const out = (Array.isArray(placed) ? [...placed] : []) as TableDecoration[];
  for (const d of state.decorations ?? []) {
    if (d.ownerUserId !== userId) {
      out.push(d as TableDecoration);
      continue;
    }
    const existing = out.find((x) => x.id === d.id);
    if (!existing) out.push(d as TableDecoration);
    else {
      existing.x = d.x;
      existing.y = d.y;
    }
  }
  return out;
}

function returnPlacedCollectiblesToInventory(
  inv: Inventory,
  decorations: TableState["decorations"] | null,
  now: number,
): Inventory {
  const i = normalizeInventory(inv);
  i.collectibles = i.collectibles ?? { owned: {}, figurines: [], placed: [] };
  i.collectibles.owned = i.collectibles.owned ?? {};
  i.collectibles.figurines = Array.isArray(i.collectibles.figurines)
    ? i.collectibles.figurines
    : [];
  i.collectibles.placed = Array.isArray(i.collectibles.placed)
    ? i.collectibles.placed
    : [];

  const owned = i.collectibles.owned as Record<string, number>;
  const figs = i.collectibles.figurines;
  const placed = i.collectibles.placed as unknown as TableDecoration[];
  const decoList = (Array.isArray(decorations) ? decorations : []) as TableDecoration[];

  for (const p of placed) {
    const kind = p.kind === "figurine" ? "figurine" : "emoji";
    if (kind === "emoji") {
      const key = String(p.key ?? "").trim();
      if (!key) continue;
      owned[key] = Math.max(0, Math.floor(Number(owned[key] ?? 0) || 0) + 1);
    } else {
      const id = String(p.key ?? p.id ?? "").trim();
      const decoId = String(p.id ?? "").trim();
      let imageUrl = String(p.imageUrl ?? "").trim();
      if (!imageUrl && decoId) {
        const deco = decoList.find((d) => String(d.id ?? "") === decoId);
        imageUrl = String(deco?.imageUrl ?? "").trim();
      }
      if (id && imageUrl)
        figs.push({ id, imageUrl, createdAt: Number(p.createdAt ?? now) || now });
    }
  }

  i.collectibles.owned = owned;
  i.collectibles.figurines = figs;
  i.collectibles.placed = [];
  return i;
}

function removeUserBlackjackDecorations(state: TableState, userId: string): void {
  state.decorations = (state.decorations ?? []).filter((d) => d.ownerUserId !== userId);
}

function ensureBlackjackDecorations(state: TableState): void {
  state.decorations = Array.isArray(state.decorations) ? state.decorations : [];
}

export function applyChatMessage(
  state: TableState,
  userId: string,
  input: { username: string; text: string; at: number; prestigeLevel?: number; nameColor?: string | null },
): { state: TableState; error?: string } {
  const s = state;
  const text = String(input.text ?? "").trim();
  if (!text) return { state: s, error: "Empty message." };
  if (text.length > BLACKJACK.CHAT_MAX_LENGTH) return { state: s, error: "Message too long." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  const isSeated = seatIdx >= 0;
  const isSpectator = (s.spectators ?? []).includes(userId);
  if (!isSeated && !isSpectator) return { state: s, error: "Join the room to chat." };

  const line = {
    id: shortLongId(),
    userId,
    username: String(input.username ?? "").trim() || "Guest",
    text,
    at: Number(input.at ?? Date.now()) || Date.now(),
    prestigeLevel: Math.max(0, Math.floor(Number(input.prestigeLevel ?? 0) || 0)),
    nameColor: (input.nameColor ?? null) as string | null,
  };
  s.chat = s.chat ?? [];
  s.chat.push(line);
  if (s.chat.length > BLACKJACK.CHAT_HISTORY_CAP) {
    s.chat = s.chat.slice(s.chat.length - BLACKJACK.CHAT_HISTORY_CAP);
  }
  return { state: s };
}

export function safePublicStateForUser(state: TableState, userId: string) {
  const { password: _pw, ...rest } = state;
  const publicState = rest as Omit<TableState, "password">;

  if (publicState.phase === "player_turns") {
    publicState.dealer = {
      ...publicState.dealer,
      cards: publicState.dealer.cards.map((c, i) => (i === 1 ? -1 : c)),
    };
  }

  const seatsWithoutInventory = publicState.seats.map((p) => {
    if (!p) return null;
    const { inventory: _inv, ...pRest } = p as PlayerSeat & { inventory?: Inventory };
    return {
      ...pRest,
      allInWinStreak: Math.max(
        0,
        Math.floor(Number(p.inventory?.allInWinStreak ?? 0) || 0),
      ),
    };
  });

  const peekCard = publicState.peekByUserId?.[userId] ?? null;
  const meSeatIndex = publicState.seats.findIndex((p) => p?.userId === userId);
  const meInventory = meSeatIndex >= 0 ? (publicState.seats[meSeatIndex]?.inventory ?? null) : null;
  const lastResult = publicState.lastResults?.[userId] ?? null;

  return {
    state: {
      ...publicState,
      seats: seatsWithoutInventory,
      peekCard,
      meSeatIndex,
      meInventory,
      lastResult,
    },
  };
}
