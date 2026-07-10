import "server-only";

import type { BlackjackTable, BlackjackHand, PlayerSeat, SpecialId, CardIndex } from "../../../shared/types";
import { handTotal, encodeMagicCard, lcg } from "../cards";
import { normalizeInventory, classifySpecial, specialLabel, invGet, invConsume } from "../inventory";
import { shortLongId } from "../lifecycle";

export type Phase = BlackjackTable["phase"];

export interface PowerupExecutionContext {
  table: BlackjackTable;
  actorSeatIndex: number;
  actor: PlayerSeat;
  targetSeat: PlayerSeat | null;
  targetSeatIndex: number | null;
  targetHandIndex: number | null;
  cardIndex: number | null;
  now: number;
  rand: () => number;
  powerupId?: SpecialId;
}

export interface PowerupEffectResult {
  success: boolean;
  error?: string;
  events?: Array<{ text: string; ttl: number }>;
  effectHistoryEntry?: PowerupEffectHistoryEntry;
}

export interface PowerupEffectHistoryEntry {
  id: string;
  at: number;
  fromUserId: string;
  fromUsername: string;
  powerupId: SpecialId;
  powerupName: string;
}

export type TargetResolver = (
  ctx: PowerupExecutionContext,
  input: { targetUserId?: string | null }
) => { seat: PlayerSeat | null; seatIndex: number | null; error?: string };

export type TimingGate = (ctx: PowerupExecutionContext) => boolean;

export interface PowerupDef {
  id: SpecialId;
  name: string;
  desc: string;
  rarity: "common" | "rare" | "legendary" | "mythic";
  timing: "betting" | "own_turn" | "dealer_window" | "anytime";
  target: "self" | "dealer" | "any";
  category: string;
  singleUsePerRound?: boolean;
  
  canUse?: (ctx: PowerupExecutionContext) => boolean | string;
  execute: (ctx: PowerupExecutionContext) => PowerupEffectResult;
}

export const PowerupRegistry: Map<SpecialId, PowerupDef> = new Map();

export function registerPowerup(def: PowerupDef): void {
  PowerupRegistry.set(def.id, def);
}

export function getPowerup(id: SpecialId): PowerupDef | undefined {
  return PowerupRegistry.get(id);
}

export function resolveTarget(
  ctx: PowerupExecutionContext,
  input: { targetUserId?: string | null }
): { seat: PlayerSeat | null; seatIndex: number | null; error?: string } {
  const { table, actor } = ctx;
  const powerupId = ctx.powerupId;
  if (!powerupId) return { seat: null, seatIndex: null, error: "No powerup specified." };
  const def = getPowerup(powerupId);
  if (!def) return { seat: null, seatIndex: null, error: "Unknown powerup." };
  
  if (def.target === "self") {
    return { seat: actor, seatIndex: ctx.actorSeatIndex };
  }
  if (def.target === "dealer") {
    return { seat: null, seatIndex: null };
  }
  
  const tuid = input.targetUserId ?? ctx.actor.userId;
  if (tuid === "-1") {
    return { seat: null, seatIndex: null };
  }
  
  const idx = table.seats.findIndex((p: PlayerSeat | null) => p?.userId === tuid);
  if (idx < 0) return { seat: null, seatIndex: null, error: "Target not seated." };
  return { seat: table.seats[idx]!, seatIndex: idx };
}

export function createDefaultExecutionContext(
  table: BlackjackTable,
  userId: string,
  now: number
): PowerupExecutionContext | null {
  const seatIndex = table.seats.findIndex((p: PlayerSeat | null) => p?.userId === userId);
  if (seatIndex < 0) return null;
  const actor = table.seats[seatIndex]!;
  
  return {
    table,
    actorSeatIndex: seatIndex,
    actor,
    targetSeat: null,
    targetSeatIndex: null,
    targetHandIndex: null,
    cardIndex: null,
    now,
    rand: lcg(Math.floor(now / 1000) ^ (seatIndex * 1337) ^ (table.round * 4242)),
  };
}

export function addBonusPoints(
  target: PlayerSeat | BlackjackTable["dealer"],
  handIndex: number,
  amount: number,
  checkBust: boolean = true
): void {
  const hand = getHand(target, handIndex);
  if (!hand) return;
  hand.bonusPoints += amount;
  if (checkBust) {
    const total = handTotal(hand.cards, hand.bonusPoints).total;
    if (total > 21) hand.busted = true;
  }
}

export function removeCard(
  hand: BlackjackHand,
  cardIdx: number
): CardIndex | null {
  if (cardIdx < 0 || cardIdx >= hand.cards.length) return null;
  const removed = hand.cards.splice(cardIdx, 1)[0];
  if (handTotal(hand.cards, hand.bonusPoints).total <= 21) {
    hand.busted = false;
  }
  return removed ?? null;
}

export function drawCardFromShoe(table: BlackjackTable): CardIndex | null {
  if (table.shoe.length === 0) return null;
  return table.shoe.pop() ?? null;
}

export function addCardToHand(
  hand: BlackjackHand,
  card: CardIndex,
  checkBust: boolean = true
): void {
  hand.cards.push(card);
  if (checkBust) {
    const total = handTotal(hand.cards, hand.bonusPoints).total;
    if (total > 21) hand.busted = true;
  }
}

export function getHand(
  target: PlayerSeat | BlackjackTable["dealer"],
  handIndex: number
): BlackjackHand | null {
  if ("hands" in target) {
    return target.hands?.[handIndex] ?? null;
  }
  return null;
}

export function swapLastCard(hand: BlackjackHand, newCard: CardIndex): void {
  if (hand.cards.length === 0) return;
  hand.cards[hand.cards.length - 1] = newCard;
  const total = handTotal(hand.cards, hand.bonusPoints).total;
  hand.busted = total > 21;
}

export function createEffectHistoryEntry(
  userId: string,
  username: string,
  powerupId: SpecialId,
  now: number
): PowerupEffectHistoryEntry {
  return {
    id: shortLongId(),
    at: now,
    fromUserId: userId,
    fromUsername: username,
    powerupId,
    powerupName: specialLabel(powerupId),
  };
}

export const SINGLE_USE_PER_ROUND = new Set<SpecialId>([
  "ADD2_SELF",
  "ADD1_SELF",
  "PEEK_NEXT",
  "BJ_PROTECTOR",
  "FREE_SPLIT",
  "SWAP_ONE",
  "DOUBLE_PAYOUT",
  "REMOVE_CARD_SELF",
  "REMOVE_RANDOM_SELF",
  "ADD2_DEALER",
  "DEALER_SECOND_CHANCE",
  "ADD1_MAGIC",
  "ADD2_MAGIC",
  "SUB1_SELF",
  "SUB2_SELF",
  "SUB5_SELF",
  "SUB10_SELF",
  "MAGIC_ACE",
  "MAGIC_KING",
  "MAGIC_QUEEN",
  "MAGIC_JACK",
  "MAGIC_JOKER",
  "MYTHIC_COPY_HANDS",
]);

registerPowerup({
  id: "ADD2_SELF",
  name: "+2 Points",
  desc: "Add 2 bonus points to your hand total.",
  rarity: "common",
  timing: "own_turn",
  target: "self",
  category: "bonus_self",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand) return { success: false, error: "No active hand." };
    addBonusPoints(ctx.actor, ctx.actor.activeHandIndex ?? 0, 2, true);
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "ADD2_SELF",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "ADD1_SELF",
  name: "+1 Point",
  desc: "Add 1 bonus point to your hand total.",
  rarity: "common",
  timing: "own_turn",
  target: "self",
  category: "bonus_self",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand) return { success: false, error: "No active hand." };
    addBonusPoints(ctx.actor, ctx.actor.activeHandIndex ?? 0, 1, true);
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "ADD1_SELF",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "PEEK_NEXT",
  name: "Peek Next Card",
  desc: "See the next card in the shoe.",
  rarity: "rare",
  timing: "own_turn",
  target: "self",
  category: "info",
  singleUsePerRound: true,
  execute: (ctx) => {
    const next = ctx.table.shoe[ctx.table.shoe.length - 1];
    if (next == null) return { success: false, error: "Shoe empty." };
    ctx.table.peekByUserId[ctx.actor.userId] = next;
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "PEEK_NEXT",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "BJ_PROTECTOR",
  name: "Blackjack Protector",
  desc: "Protect your bet if dealer gets blackjack.",
  rarity: "rare",
  timing: "betting",
  target: "self",
  category: "protection",
  singleUsePerRound: true,
  execute: (ctx) => {
    ctx.actor.bjProtected = true;
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "BJ_PROTECTOR",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "SWAP_ONE",
  name: "Swap Card",
  desc: "Replace your last drawn card with the next shoe card.",
  rarity: "rare",
  timing: "own_turn",
  target: "self",
  category: "modify_self",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand || hand.cards.length === 0) {
      return { success: false, error: "No cards to swap." };
    }
    const newCard = drawCardFromShoe(ctx.table);
    if (newCard == null) return { success: false, error: "Shoe empty." };
    swapLastCard(hand, newCard);
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "SWAP_ONE",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "DOUBLE_PAYOUT",
  name: "Double Payout",
  desc: "Double your payout if you win this hand.",
  rarity: "legendary",
  timing: "own_turn",
  target: "self",
  category: "payout",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand) return { success: false, error: "No active hand." };
    hand.doublePayoutArmed = true;
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "DOUBLE_PAYOUT",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "REMOVE_RANDOM_SELF",
  name: "Remove Random Card",
  desc: "Remove a random card from your hand.",
  rarity: "rare",
  timing: "own_turn",
  target: "self",
  category: "modify_self",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand || hand.cards.length === 0) {
      return { success: false, error: "No cards to remove." };
    }
    const idx = Math.floor(ctx.rand() * hand.cards.length);
    removeCard(hand, idx);
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "REMOVE_RANDOM_SELF",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "REMOVE_CARD_SELF",
  name: "Remove Card",
  desc: "Remove a chosen card from your hand.",
  rarity: "rare",
  timing: "own_turn",
  target: "self",
  category: "modify_self",
  singleUsePerRound: true,
  execute: (ctx) => {
    const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
    if (!hand || hand.cards.length === 0) {
      return { success: false, error: "No cards to remove." };
    }
    if (ctx.cardIndex == null || ctx.cardIndex < 0 || ctx.cardIndex >= hand.cards.length) {
      return { success: false, error: "Choose a card to remove." };
    }
    removeCard(hand, ctx.cardIndex);
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "REMOVE_CARD_SELF",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "ADD2_DEALER",
  name: "Dealer +2",
  desc: "Add 2 bonus points to the dealer's hand.",
  rarity: "common",
  timing: "dealer_window",
  target: "dealer",
  category: "bonus_dealer",
  singleUsePerRound: true,
  execute: (ctx) => {
    ctx.table.dealer.bonusPoints += 2;
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "ADD2_DEALER",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "DEALER_SECOND_CHANCE",
  name: "Dealer Second Chance",
  desc: "Force dealer to redraw if they bust.",
  rarity: "legendary",
  timing: "dealer_window",
  target: "dealer",
  category: "protection",
  singleUsePerRound: true,
  execute: (ctx) => {
    ctx.table.dealer.secondChanceArmed = true;
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "DEALER_SECOND_CHANCE",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "ADD2_TARGET",
  name: "Target +2",
  desc: "Add 2 bonus points to any player's hand (or dealer).",
  rarity: "common",
  timing: "anytime",
  target: "any",
  category: "bonus_target",
  singleUsePerRound: true,
  execute: (ctx) => {
    const target = ctx.targetSeat ?? ctx.table.dealer;
    if ("hands" in target && target.hands) {
      const hand = target.hands[target.activeHandIndex ?? 0];
      if (hand) {
        addBonusPoints(target, target.activeHandIndex ?? 0, 2, true);
      }
    } else if (!("hands" in target)) {
      target.bonusPoints += 2;
    }
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "ADD2_TARGET",
        ctx.now
      ),
    };
  },
});

registerPowerup({
  id: "FORCE_HIT_TARGET",
  name: "Force Hit",
  desc: "Force any player (or dealer) to draw a card.",
  rarity: "rare",
  timing: "anytime",
  target: "any",
  category: "modify_target",
  singleUsePerRound: true,
  execute: (ctx) => {
    const card = drawCardFromShoe(ctx.table);
    if (card == null) return { success: false, error: "Shoe empty." };
    const target = ctx.targetSeat ?? ctx.table.dealer;
    if ("hands" in target && target.hands) {
      const hand = target.hands[target.activeHandIndex ?? 0];
      if (hand) {
        addCardToHand(hand, card, true);
      }
    } else if (!("hands" in target)) {
      target.cards.push(card);
    }
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "FORCE_HIT_TARGET",
        ctx.now
      ),
    };
  },
});

function registerSubPowerups() {
  const subs: Array<{ id: SpecialId; delta: number }> = [
    { id: "SUB1_SELF", delta: -1 },
    { id: "SUB2_SELF", delta: -2 },
    { id: "SUB5_SELF", delta: -5 },
    { id: "SUB10_SELF", delta: -10 },
  ];
  
  for (const { id, delta } of subs) {
    registerPowerup({
      id,
      name: `${Math.abs(delta)} Point Reduction`,
      desc: `Subtract ${Math.abs(delta)} from your hand total.`,
      rarity: delta <= -5 ? "legendary" : "rare",
      timing: "own_turn",
      target: "self",
      category: "bonus_self",
      singleUsePerRound: true,
      execute: (ctx) => {
        const hand = ctx.actor.hands[ctx.actor.activeHandIndex ?? 0];
        if (!hand) return { success: false, error: "No active hand." };
        hand.bonusPoints += delta;
        if (handTotal(hand.cards, hand.bonusPoints).total <= 21) {
          hand.busted = false;
        }
        return {
          success: true,
          effectHistoryEntry: createEffectHistoryEntry(
            ctx.actor.userId,
            ctx.actor.username,
            id,
            ctx.now
          ),
        };
      },
    });
  }
}

function registerMagicPowerups() {
  const magicRanks: Array<{ prefix: string; rank: "A" | "K" | "Q" | "J" | "JOKER" }> = [
    { prefix: "MAGIC_ACE", rank: "A" },
    { prefix: "MAGIC_KING", rank: "K" },
    { prefix: "MAGIC_QUEEN", rank: "Q" },
    { prefix: "MAGIC_JACK", rank: "J" },
    { prefix: "MAGIC_JOKER", rank: "JOKER" },
  ];
  
  for (const { prefix, rank } of magicRanks) {
    const id = prefix as SpecialId;
    registerPowerup({
      id,
      name: `Magic ${rank}`,
      desc: `Summon a magic ${rank} card.`,
      rarity: rank === "JOKER" ? "mythic" : "legendary",
      timing: "own_turn",
      target: "any",
      category: "magic",
      singleUsePerRound: true,
      execute: (ctx) => {
        const suitIdx = Math.floor(ctx.rand() * 4);
        const magicCard = encodeMagicCard(rank, suitIdx);
        const target = ctx.targetSeat ?? ctx.table.dealer;
        if ("hands" in target && target.hands) {
          const hand = target.hands[target.activeHandIndex ?? 0];
          if (hand) {
            addCardToHand(hand, magicCard, true);
          }
        } else if (!("hands" in target)) {
          target.cards.push(magicCard);
        }
        return {
          success: true,
          effectHistoryEntry: createEffectHistoryEntry(
            ctx.actor.userId,
            ctx.actor.username,
            id,
            ctx.now
          ),
        };
      },
    });
  }
}

function registerAddMagicPowerups() {
  const addMagic: Array<{ id: SpecialId; count: number }> = [
    { id: "ADD1_MAGIC", count: 1 },
    { id: "ADD2_MAGIC", count: 2 },
  ];
  
  for (const { id, count } of addMagic) {
    registerPowerup({
      id,
      name: `+${count} Random Cards`,
      desc: `Add ${count} random card(s) to any hand.`,
      rarity: count === 1 ? "rare" : "legendary",
      timing: "anytime",
      target: "any",
      category: "magic",
      singleUsePerRound: true,
      execute: (ctx) => {
        const target = ctx.targetSeat ?? ctx.table.dealer;
        const cards: CardIndex[] = [];
        for (let i = 0; i < count; i++) {
          const card = Math.floor(ctx.rand() * 52);
          cards.push(card);
        }
        if ("hands" in target && target.hands) {
          const hand = target.hands[target.activeHandIndex ?? 0];
          if (hand) {
            for (const c of cards) addCardToHand(hand, c, true);
          }
        } else if (!("hands" in target)) {
          for (const c of cards) target.cards.push(c);
        }
        return {
          success: true,
          effectHistoryEntry: createEffectHistoryEntry(
            ctx.actor.userId,
            ctx.actor.username,
            id,
            ctx.now
          ),
        };
      },
    });
  }
}

registerSubPowerups();
registerMagicPowerups();
registerAddMagicPowerups();

registerPowerup({
  id: "MYTHIC_COPY_HANDS",
  name: "Copy Hands",
  desc: "Copy the target's hand to all players at the table.",
  rarity: "mythic",
  timing: "anytime",
  target: "any",
  category: "mythic",
  singleUsePerRound: true,
  execute: (ctx) => {
    if (!ctx.targetSeat) {
      return { success: false, error: "Choose a player to copy." };
    }
    const copyFrom = ctx.targetSeat.hands?.[ctx.targetSeat.activeHandIndex ?? 0];
    if (!copyFrom) {
      return { success: false, error: "Target has no hand to copy." };
    }
    for (const other of ctx.table.seats) {
      if (!other) continue;
      other.hands = [
        {
          bet: other.hands?.[0]?.bet ?? other.bet ?? 0,
          nonces: [],
          perfectPairsWager: other.hands?.[0]?.perfectPairsWager ?? 0,
          perfectPairsNonce: null,
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
    }
    return {
      success: true,
      effectHistoryEntry: createEffectHistoryEntry(
        ctx.actor.userId,
        ctx.actor.username,
        "MYTHIC_COPY_HANDS",
        ctx.now
      ),
    };
  },
});

export function executePowerup(
  table: BlackjackTable,
  userId: string,
  powerupId: SpecialId,
  input: { targetUserId?: string | null; cardIndex?: number | null },
  now: number
): { table: BlackjackTable; error?: string } {
  const ctx = createDefaultExecutionContext(table, userId, now);
  if (!ctx) return { table, error: "You are not seated." };
  
  const def = getPowerup(powerupId);
  if (!def) return { table, error: "Unknown powerup." };
  
  ctx.powerupId = powerupId;
  const { seat: targetSeat, seatIndex: targetSeatIndex, error: targetError } = resolveTarget(ctx, input);
  if (targetError) return { table, error: targetError };
  ctx.targetSeat = targetSeat;
  ctx.targetSeatIndex = targetSeatIndex;
  ctx.cardIndex = input.cardIndex ?? null;
  
  const cat = classifySpecial(powerupId);
  if ((table.disabledCategories ?? []).includes(cat)) {
    return { table, error: "That powerup category is disabled." };
  }
  
  const actor = ctx.actor;
  actor.inventory = normalizeInventory(actor.inventory);
  const inv = actor.inventory;
  if (invGet(inv, powerupId) <= 0) {
    return { table, error: "No charges left." };
  }
  
  if (def.singleUsePerRound && actor.usedThisRound?.[powerupId]) {
    return { table, error: "Already used this round." };
  }
  
  const timingError = validateTiming(ctx, def);
  if (timingError) return { table, error: timingError };
  
  const result = def.execute(ctx);
  if (!result.success) {
    return { table, error: result.error };
  }
  
  if (def.singleUsePerRound) {
    actor.usedThisRound = actor.usedThisRound ?? {};
    actor.usedThisRound[powerupId] = true;
  }
  
  invConsume(inv, powerupId);
  
  if (result.effectHistoryEntry) {
    const hand = actor.hands[actor.activeHandIndex ?? 0];
    if (hand) {
      hand.effects = hand.effects ?? [];
      hand.effects.push(result.effectHistoryEntry);
    }
  }
  
  return { table };
}

function validateTiming(ctx: PowerupExecutionContext, def: PowerupDef): string | null {
  const { table, actor } = ctx;
  const currentTurnSeatIdx = table.seats.findIndex(
    (p: PlayerSeat | null, i: number) => p != null && table.phase === "player_turns" && i === currentBlackjackTurnSeatIndex(table)
  );
  const isOwnTurn = table.phase === "player_turns" && currentTurnSeatIdx >= 0 && table.seats[currentTurnSeatIdx]?.userId === actor.userId;
  const isBeforeEndOfRound = ["player_turns", "dealer", "dealer_window"].includes(table.phase);
  const isBetting = table.phase === "betting";
  
  if (def.timing === "betting" && !isBetting) return "Only usable during betting.";
  if (def.timing === "own_turn" && !isOwnTurn) return "Only usable on your turn.";
  if (def.timing === "dealer_window" && table.phase !== "dealer_window") return "Only usable after dealer stands.";
  if (def.timing === "anytime" && !isBeforeEndOfRound) return "Only usable before end of round.";
  
  return null;
}

function currentBlackjackTurnSeatIndex(table: BlackjackTable): number | null {
  if (table.phase !== "player_turns") return null;
  for (let i = 0; i < table.seats.length; i++) {
    const seat = table.seats[i];
    if (!seat) continue;
    const hand = seat.hands?.[seat.activeHandIndex ?? 0];
    if (hand && !hand.turnEnded && !hand.busted) {
      return i;
    }
  }
  return null;
}
