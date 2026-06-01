"server-only";

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type Card = { rank: Rank; suit: Suit; value: number }; // value for non-ace

export type Phase =
  | "betting"
  | "player_turns"
  | "dealer"
  | "dealer_window" // dealer has stood; short window for dealer-phase specials
  | "settling";

export type SpecialId =
  | "ADD2_SELF"
  | "PEEK_NEXT"
  | "SWAP_ONE"
  | "DOUBLE_PAYOUT"
  | "ADD2_DEALER"
  | "DEALER_SECOND_CHANCE"
  | "ADD2_TARGET"
  | "FORCE_HIT_TARGET";

export type SpecialRarity = "common" | "rare";
export type SpecialTiming = "own_turn" | "dealer_window" | "anytime";

export type SpecialDef = {
  id: SpecialId;
  name: string;
  desc: string;
  rarity: SpecialRarity;
  timing: SpecialTiming;
  target: "self" | "dealer" | "any";
};

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  ADD2_SELF: {
    id: "ADD2_SELF",
    name: "+2 (You)",
    desc: "Add +2 to your hand total. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  PEEK_NEXT: {
    id: "PEEK_NEXT",
    name: "Peek",
    desc: "Peek the next card on top of the shoe. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  SWAP_ONE: {
    id: "SWAP_ONE",
    name: "Swap",
    desc: "Swap one of your cards with the next card from the shoe. Only usable on your turn.",
    rarity: "rare",
    timing: "own_turn",
    target: "self",
  },
  DOUBLE_PAYOUT: {
    id: "DOUBLE_PAYOUT",
    name: "Double Payout",
    desc: "If you win this round, double your payout multiplier. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  ADD2_DEALER: {
    id: "ADD2_DEALER",
    name: "+2 (Dealer)",
    desc: "Add +2 to the dealer total. Usable after dealer stands and before next round.",
    rarity: "rare",
    timing: "dealer_window",
    target: "dealer",
  },
  DEALER_SECOND_CHANCE: {
    id: "DEALER_SECOND_CHANCE",
    name: "Dealer Second Chance",
    desc: "If dealer busts, reduce dealer total by 10 once. Usable after dealer stands.",
    rarity: "rare",
    timing: "dealer_window",
    target: "dealer",
  },
  ADD2_TARGET: {
    id: "ADD2_TARGET",
    name: "+2 (Target)",
    desc: "Add +2 to any player's hand total. Rare. Can be used even when it's not your turn (before dealer stands).",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  FORCE_HIT_TARGET: {
    id: "FORCE_HIT_TARGET",
    name: "Force Hit",
    desc: "Force any player to draw 1 card immediately. Rare. Can be used even when it's not your turn (before dealer stands).",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
};

export type Inventory = Record<SpecialId, number>;

export type PlayerSeat = {
  userId: number;
  username: string;
  joinedAt: number;
  lastSeenAt: number;
  missedRounds: number;
  skipThisRound: boolean;
  inventory: Inventory;

  // round state
  bet: number;
  betNonce?: number | null; // client-side only; kept for convenience
  cards: number[];
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  doublePayoutArmed: boolean;
  usedThisRound: Partial<Record<SpecialId, boolean>>;
};

export type TableState = {
  id: string;
  public: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  // Updated only on player activity (join/leave/bet/actions), NOT on passive polling ticks.
  lastActivityAt: number;

  phase: Phase;
  round: number;
  bettingEndsAt: number; // epoch ms
  turnEndsAt: number; // epoch ms for current player
  dealerWindowEndsAt: number; // epoch ms

  seats: Array<PlayerSeat | null>; // length 10
  spectators: number[]; // userIds

  participants: number[]; // seat indices for this round
  turnIndex: number; // index into participants

  shoe: number[]; // remaining cards (ints)
  dealer: { cards: number[]; bonusPoints: number; secondChanceArmed: boolean; secondChanceUsed: boolean };
  peekByUserId: Record<string, number | null>; // userId -> cardIndex or null
  evictedInventories: Array<{ userId: number; inventory: Inventory }>;

  lastResults?: Record<string, { outcome: string; multiplier: number }>;
};

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

export function handTotal(cards: number[], bonusPoints = 0): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    const c = cardFromIndex(idx);
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  total += aces; // all aces as 1
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += bonusPoints;
  return { total, soft };
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s % 1_000_000) / 1_000_000;
  };
}

function shuffleDeck(seed: number) {
  const rand = lcg(seed);
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

export function defaultInventory(): Inventory {
  return {
    ADD2_SELF: 1,
    PEEK_NEXT: 1,
    DOUBLE_PAYOUT: 1,
    SWAP_ONE: 0,
    ADD2_DEALER: 0,
    DEALER_SECOND_CHANCE: 0,
    ADD2_TARGET: 0,
    FORCE_HIT_TARGET: 0,
  };
}

function randSpecial(seed: number, rarity: SpecialRarity): SpecialId {
  const pool = Object.values(SPECIALS).filter((s) => s.rarity === rarity).map((s) => s.id);
  const r = lcg(seed)();
  return pool[Math.floor(r * pool.length)] ?? "ADD2_SELF";
}

export function newTableState(input: { id: string; name: string; public: boolean; now: number }): TableState {
  return {
    id: input.id,
    public: input.public,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    lastActivityAt: input.now,
    phase: "betting",
    round: 1,
    bettingEndsAt: input.now + 30_000,
    turnEndsAt: 0,
    dealerWindowEndsAt: 0,
    seats: Array.from({ length: 10 }, () => null),
    spectators: [],
    participants: [],
    turnIndex: 0,
    shoe: [],
    dealer: { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false },
    peekByUserId: {},
    evictedInventories: [],
    lastResults: {},
  };
}

export function tickTable(state: TableState, now: number): TableState {
  const s: TableState = { ...state, updatedAt: now };

  // Clean dead spectators (no-op for MVP)

  if (s.phase === "betting" && now >= s.bettingEndsAt) {
    return startRound(s, now);
  }

  if (s.phase === "player_turns") {
    const curSeatIdx = s.participants[s.turnIndex];
    if (curSeatIdx == null) return startBetting(s, now);
    if (now >= s.turnEndsAt) {
      const seat = s.seats[curSeatIdx];
      if (seat) {
        seat.stood = true;
        seat.turnEnded = true;
      }
      return advanceTurn(s, now);
    }
  }

  if (s.phase === "dealer") {
    const dVal = handTotal(s.dealer.cards, s.dealer.bonusPoints).total;
    if (dVal < 17) {
      // Dealer hits
      const next = drawFromShoe(s);
      if (next != null) s.dealer.cards.push(next);
      return { ...s };
    }
    // Dealer stands -> open window for dealer specials
    s.phase = "dealer_window";
    s.dealerWindowEndsAt = now + 8_000;
    return s;
  }

  if (s.phase === "dealer_window" && now >= s.dealerWindowEndsAt) {
    return settleRound(s, now);
  }

  if (s.phase === "settling") {
    // After a short pause, start next betting
    if (now >= s.bettingEndsAt) return startBetting(s, now);
  }

  return s;
}

function startBetting(state: TableState, now: number) {
  const s: TableState = { ...state };
  s.phase = "betting";
  s.bettingEndsAt = now + 30_000;
  s.turnEndsAt = 0;
  s.dealerWindowEndsAt = 0;
  s.participants = [];
  s.turnIndex = 0;
  s.shoe = [];
  s.dealer = { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false };
  s.peekByUserId = {};
  s.lastResults = s.lastResults ?? {};
  s.evictedInventories = s.evictedInventories ?? [];

  // Reset round-specific flags, keep inventory
  for (let i = 0; i < s.seats.length; i++) {
    const p = s.seats[i];
    if (!p) continue;
    p.bet = 0;
    p.skipThisRound = false;
    p.cards = [];
    p.bonusPoints = 0;
    p.stood = false;
    p.busted = false;
    p.turnEnded = false;
    p.doublePayoutArmed = false;
    p.usedThisRound = {};
  }
  s.round += 1;
  return s;
}

function startRound(state: TableState, now: number) {
  const s: TableState = { ...state };

  const participants: number[] = [];
  for (let i = 0; i < s.seats.length; i++) {
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

  // Drop players who missed 5 rounds
  for (let i = 0; i < s.seats.length; i++) {
    const p = s.seats[i];
    if (!p) continue;
    if (p.missedRounds >= 5) {
      s.evictedInventories = s.evictedInventories ?? [];
      s.evictedInventories.push({ userId: p.userId, inventory: p.inventory });
      s.seats[i] = null;
    }
  }

  if (participants.length === 0) {
    // no one bet; restart betting
    return startBetting(s, now);
  }

  s.participants = participants;
  s.turnIndex = 0;
  s.phase = "player_turns";
  s.turnEndsAt = now + 20_000;
  s.peekByUserId = {};

  // new shoe each round (MVP)
  const seed = Math.floor(now / 1000) ^ (s.round * 2654435761);
  s.shoe = shuffleDeck(seed);
  s.dealer = { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false };

  // deal: each participant 2, dealer 2
  for (const idx of participants) {
    const p = s.seats[idx]!;
    p.cards = [];
    p.bonusPoints = 0;
    p.stood = false;
    p.busted = false;
    p.turnEnded = false;
    p.doublePayoutArmed = false;
    p.usedThisRound = {};
    const a = drawFromShoe(s);
    const b = drawFromShoe(s);
    if (a != null) p.cards.push(a);
    if (b != null) p.cards.push(b);
  }
  const d1 = drawFromShoe(s);
  const d2 = drawFromShoe(s);
  if (d1 != null) s.dealer.cards.push(d1);
  if (d2 != null) s.dealer.cards.push(d2);

  // auto-finish players with blackjack
  for (const idx of participants) {
    const p = s.seats[idx]!;
    if (handTotal(p.cards, p.bonusPoints).total === 21) {
      p.turnEnded = true;
      p.stood = true;
    }
  }
  // if first player is already ended, advance
  return advanceTurn(s, now);
}

function drawFromShoe(s: TableState): number | null {
  const next = s.shoe.pop();
  return typeof next === "number" ? next : null;
}

function currentTurnSeatIndex(s: TableState) {
  return s.participants[s.turnIndex] ?? null;
}

function advanceTurn(state: TableState, now: number): TableState {
  const s: TableState = { ...state };
  // skip ended players
  while (s.turnIndex < s.participants.length) {
    const seatIdx = s.participants[s.turnIndex]!;
    const p = s.seats[seatIdx];
    if (!p || p.turnEnded) {
      s.turnIndex += 1;
      continue;
    }
    // found active player
    s.turnEndsAt = now + 20_000;
    return s;
  }
  // all done -> dealer phase
  s.phase = "dealer";
  s.turnEndsAt = 0;
  return s;
}

export function applyBet(state: TableState, userId: number, amount: number, now: number): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "Betting is closed." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return { state: s, error: "Invalid bet amount." };
  p.bet = Math.round(a * 100) / 100;
  p.skipThisRound = false;
  p.lastSeenAt = now;
  s.lastActivityAt = now;
  return { state: { ...s, updatedAt: now } };
}

export function applySkip(state: TableState, userId: number, now: number): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only skip during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  p.bet = 0;
  p.skipThisRound = true;
  p.lastSeenAt = now;
  s.lastActivityAt = now;
  return { state: { ...s, updatedAt: now } };
}

export function applyPlayerAction(
  state: TableState,
  userId: number,
  action: { type: "hit" | "stand" },
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "Not in player turn phase." };
  const turnSeatIdx = currentTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  if (p.userId !== userId) return { state: s, error: "Not your turn." };

  if (action.type === "hit") {
    const c = drawFromShoe(s);
    if (c != null) p.cards.push(c);
    s.lastActivityAt = now;
    const t = handTotal(p.cards, p.bonusPoints).total;
    if (t > 21) {
      p.busted = true;
      p.turnEnded = true;
      p.stood = true;
      return { state: advanceTurn(s, now) };
    }
    // if 21, auto-stand
    if (t === 21) {
      p.turnEnded = true;
      p.stood = true;
      return { state: advanceTurn(s, now) };
    }
    return { state: { ...s, updatedAt: now } };
  }

  if (action.type === "stand") {
    p.turnEnded = true;
    p.stood = true;
    s.lastActivityAt = now;
    return { state: advanceTurn(s, now) };
  }

  return { state: s, error: "Unknown action." };
}

export function applySpecial(
  state: TableState,
  userId: number,
  input: { id: SpecialId; targetUserId?: number | null },
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated." };
  const actor = s.seats[seatIdx]!;
  const def = SPECIALS[input.id];
  if (!def) return { state: s, error: "Unknown special." };
  if ((actor.inventory[input.id] ?? 0) <= 0) return { state: s, error: "No charges left." };
  if (actor.usedThisRound?.[input.id]) return { state: s, error: "Already used this round." };

  const isOwnTurn = s.phase === "player_turns" && currentTurnSeatIndex(s) != null && s.seats[currentTurnSeatIndex(s)!]?.userId === userId;
  const isBeforeDealerStands = s.phase === "player_turns" || s.phase === "dealer";

  if (def.timing === "own_turn" && !isOwnTurn) return { state: s, error: "Only usable on your turn." };
  if (def.timing === "dealer_window" && s.phase !== "dealer_window") return { state: s, error: "Only usable after dealer stands." };
  if (def.timing === "anytime" && !isBeforeDealerStands) return { state: s, error: "Only usable before dealer stands." };

  // Resolve target
  let targetSeat: PlayerSeat | null = null;
  let targetSeatIdx: number | null = null;
  if (def.target === "self") {
    targetSeat = actor;
    targetSeatIdx = seatIdx;
  } else if (def.target === "dealer") {
    targetSeat = null;
    targetSeatIdx = null;
  } else {
    const tuid = Number(input.targetUserId ?? userId);
    const idx = s.seats.findIndex((p) => p?.userId === tuid);
    if (idx < 0) return { state: s, error: "Target not seated." };
    targetSeat = s.seats[idx]!;
    targetSeatIdx = idx;
  }

  // Apply effects
  if (input.id === "ADD2_SELF") {
    actor.bonusPoints += 2;
    const t = handTotal(actor.cards, actor.bonusPoints).total;
    if (t > 21) {
      actor.busted = true;
      actor.turnEnded = true;
      actor.stood = true;
      // action ends turn
      actor.usedThisRound[input.id] = true;
      actor.inventory[input.id] -= 1;
      return { state: advanceTurn(s, now) };
    }
  } else if (input.id === "PEEK_NEXT") {
    const next = s.shoe[s.shoe.length - 1];
    s.peekByUserId[String(userId)] = typeof next === "number" ? next : null;
  } else if (input.id === "SWAP_ONE") {
    if (actor.cards.length === 0) return { state: s, error: "No cards to swap." };
    const next = drawFromShoe(s);
    if (next == null) return { state: s, error: "Shoe empty." };
    // swap the last card
    actor.cards[actor.cards.length - 1] = next;
    const t = handTotal(actor.cards, actor.bonusPoints).total;
    if (t > 21) {
      actor.busted = true;
      actor.turnEnded = true;
      actor.stood = true;
      actor.usedThisRound[input.id] = true;
      actor.inventory[input.id] -= 1;
      return { state: advanceTurn(s, now) };
    }
  } else if (input.id === "DOUBLE_PAYOUT") {
    actor.doublePayoutArmed = true;
  } else if (input.id === "ADD2_DEALER") {
    s.dealer.bonusPoints += 2;
  } else if (input.id === "DEALER_SECOND_CHANCE") {
    s.dealer.secondChanceArmed = true;
  } else if (input.id === "ADD2_TARGET") {
    if (!targetSeat) return { state: s, error: "Missing target." };
    targetSeat.bonusPoints += 2;
    const t = handTotal(targetSeat.cards, targetSeat.bonusPoints).total;
    if (t > 21) {
      targetSeat.busted = true;
      targetSeat.turnEnded = true;
      targetSeat.stood = true;
      // If the targeted player was the current turn, advance.
      if (s.phase === "player_turns" && targetSeatIdx != null && currentTurnSeatIndex(s) === targetSeatIdx) {
        actor.usedThisRound[input.id] = true;
        actor.inventory[input.id] = Math.max(0, (actor.inventory[input.id] ?? 0) - 1);
        actor.lastSeenAt = now;
        return { state: advanceTurn(s, now) };
      }
    }
  } else if (input.id === "FORCE_HIT_TARGET") {
    if (!targetSeat) return { state: s, error: "Missing target." };
    // Only makes sense while players are still acting; we allow during dealer too, but it will just add to a (likely ended) hand.
    const c = drawFromShoe(s);
    if (c == null) return { state: s, error: "Shoe empty." };
    targetSeat.cards.push(c);
    const t = handTotal(targetSeat.cards, targetSeat.bonusPoints).total;
    if (t > 21) {
      targetSeat.busted = true;
      targetSeat.turnEnded = true;
      targetSeat.stood = true;
      if (s.phase === "player_turns" && targetSeatIdx != null && currentTurnSeatIndex(s) === targetSeatIdx) {
        actor.usedThisRound[input.id] = true;
        actor.inventory[input.id] = Math.max(0, (actor.inventory[input.id] ?? 0) - 1);
        actor.lastSeenAt = now;
        return { state: advanceTurn(s, now) };
      }
    }
  }

  actor.usedThisRound[input.id] = true;
  actor.inventory[input.id] = Math.max(0, (actor.inventory[input.id] ?? 0) - 1);
  actor.lastSeenAt = now;
  s.lastActivityAt = now;

  return { state: { ...s, updatedAt: now } };
}

function settleRound(state: TableState, now: number): TableState {
  const s: TableState = { ...state };
  const dBase = handTotal(s.dealer.cards, s.dealer.bonusPoints).total;
  let dTotal = dBase;
  if (dTotal > 21 && s.dealer.secondChanceArmed && !s.dealer.secondChanceUsed) {
    dTotal -= 10;
    s.dealer.secondChanceUsed = true;
  }

  const results: Record<string, { outcome: string; multiplier: number }> = {};
  for (const seatIdx of s.participants) {
    const p = s.seats[seatIdx];
    if (!p) continue;
    const pTotal = handTotal(p.cards, p.bonusPoints).total;
    let mult = 0;
    let outcome = "";
    const pBJ = pTotal === 21 && p.cards.length === 2;
    const dBJ = dTotal === 21 && s.dealer.cards.length === 2;

    if (pTotal > 21) {
      mult = 0;
      outcome = `Bust (${pTotal})`;
    } else if (dBJ && pBJ) {
      mult = 1;
      outcome = "Push (both blackjack)";
    } else if (pBJ) {
      mult = 2.5;
      outcome = "Blackjack (3:2)";
    } else if (dTotal > 21) {
      mult = 2;
      outcome = `Dealer bust (${dTotal})`;
    } else if (pTotal > dTotal) {
      mult = 2;
      outcome = `${pTotal} > ${dTotal}`;
    } else if (pTotal < dTotal) {
      mult = 0;
      outcome = `${pTotal} < ${dTotal}`;
    } else {
      mult = 1;
      outcome = `Push (${pTotal})`;
    }

    if (p.doublePayoutArmed && mult > 1) mult *= 2;

    // Earn specials (MVP): everyone who participated earns 1 common; winners get extra roll and small rare chance.
    const seed = Math.floor(now / 1000) ^ (s.round * 1103515245) ^ (p.userId * 2654435761);
    const earnCommon = randSpecial(seed + 1, "common");
    p.inventory[earnCommon] = (p.inventory[earnCommon] ?? 0) + 1;
    if (mult > 1) {
      const earn2 = randSpecial(seed + 2, "common");
      p.inventory[earn2] = (p.inventory[earn2] ?? 0) + 1;
      // 20% rare
      if (lcg(seed + 3)() < 0.2) {
        const rare = randSpecial(seed + 4, "rare");
        p.inventory[rare] = (p.inventory[rare] ?? 0) + 1;
      }
    }

    results[String(p.userId)] = { outcome, multiplier: mult };
  }

  s.lastResults = results;
  s.phase = "settling";
  s.bettingEndsAt = now + 4_000; // short intermission then betting
  s.dealerWindowEndsAt = 0;
  return s;
}

export function safePublicStateForUser(state: TableState, userId: number) {
  const meSeat = state.seats.find((p) => p?.userId === userId) ?? null;
  const peek = state.peekByUserId[String(userId)] ?? null;
  // hide dealer hole card during player turns
  const hideDealerHole = state.phase === "player_turns";
  const dealerCards = hideDealerHole ? state.dealer.cards.map((c, i) => (i === 1 ? -1 : c)) : state.dealer.cards;

  return {
    ...state,
    dealer: { ...state.dealer, cards: dealerCards },
    // spectators list is fine
    peekCard: peek,
    meSeatIndex: state.seats.findIndex((p) => p?.userId === userId),
    meInventory: meSeat?.inventory ?? null,
    lastResult: state.lastResults?.[String(userId)] ?? null,
  };
}
