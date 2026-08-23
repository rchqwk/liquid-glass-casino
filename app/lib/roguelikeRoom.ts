// Roguelike Blackjack — multiplayer room engine (server-side authority).
// Room-code table for up to 4 players. Three modes: coop, race, elimination.
// Players can gift support powerups to each other. XP is split among survivors.

import {
  buildStandardDeck,
  computeHandValue,
  isBlackjack,
  outcomeOf,
  type Card,
  type HandOutcome,
} from "../arcade/blackjack-roguelike/game";
import { getRoguelikeRoom, upsertRoguelikeRoom, addUserXp } from "./db";

export const MAX_PLAYERS = 4;
export const MAX_ROUNDS = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RoomMode = "coop" | "race" | "elimination";

export type SupportId = "add2" | "add1" | "sub2" | "draw";

export const SUPPORT: Record<SupportId, { name: string; desc: string }> = {
  add2: { name: "+2 Points", desc: "Add +2 to a teammate's hand." },
  add1: { name: "+1 Point", desc: "Add +1 to a teammate's hand." },
  sub2: { name: "-2 Save", desc: "Subtract 2 from a teammate's hand." },
  draw: { name: "Draw Card", desc: "Deal a card to a teammate." },
};

export interface RoomPlayer {
  playerId: string;
  username: string;
  userId: number | null; // linked account (for XP persistence), null if anonymous
  hands: Card[][];
  handBonuses: number[];
  activeHand: number;
  stood: boolean[];
  outcomes: (HandOutcome | null)[];
  results: ({ value: number; blackjack: boolean; charlie: boolean; bust: boolean } | null)[];
  done: boolean;
  eliminated: boolean;
  wins: number;
  support: Partial<Record<SupportId, number>>;
}

export type RoomPhase = "lobby" | "playing" | "reveal";

export interface XpAward {
  playerId: string;
  username: string;
  amount: number;
}

export interface RoguelikeRoom {
  code: string;
  hostId: string;
  mode: RoomMode;
  players: RoomPlayer[];
  dealer: Card[];
  deck: Card[];
  phase: RoomPhase;
  round: number;
  runEnded: boolean;
  xp: XpAward[] | null;
  updatedAt: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function generateRoomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return out;
}

function newPlayer(playerId: string, username: string, userId: number | null = null): RoomPlayer {
  return {
    playerId,
    username,
    userId,
    hands: [],
    handBonuses: [],
    activeHand: 0,
    stood: [],
    outcomes: [],
    results: [],
    done: false,
    eliminated: false,
    wins: 0,
    support: { add2: 2, add1: 2, sub2: 1, draw: 1 },
  };
}

export function createRoom(code: string, hostId: string, username: string, mode: RoomMode, userId: number | null = null): RoguelikeRoom {
  return {
    code,
    hostId,
    mode,
    players: [newPlayer(hostId, username, userId)],
    dealer: [],
    deck: [],
    phase: "lobby",
    round: 0,
    runEnded: false,
    xp: null,
    updatedAt: Date.now(),
  };
}

export function joinRoom(room: RoguelikeRoom, playerId: string, username: string, userId: number | null = null): { room: RoguelikeRoom; error?: string } {
  const existing = room.players.find((p) => p.playerId === playerId);
  if (existing) {
    existing.username = username;
    if (userId != null) existing.userId = userId;
    room.updatedAt = Date.now();
    return { room };
  }
  if (room.players.length >= MAX_PLAYERS) {
    return { room, error: "Room is full." };
  }
  room.players.push(newPlayer(playerId, username, userId));
  room.updatedAt = Date.now();
  return { room };
}

export function leaveRoom(room: RoguelikeRoom, playerId: string): RoguelikeRoom {
  room.players = room.players.filter((p) => p.playerId !== playerId);
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0]!.playerId;
  }
  room.updatedAt = Date.now();
  return room;
}

export function dealRoom(room: RoguelikeRoom): RoguelikeRoom {
  const deck = shuffle(buildStandardDeck());
  const dealer: Card[] = [deck.shift()!, deck.shift()!];
  for (const p of room.players) {
    if (p.eliminated) {
      p.hands = [];
      p.handBonuses = [];
      p.activeHand = 0;
      p.stood = [];
      p.outcomes = [];
      p.results = [];
      p.done = true;
      continue;
    }
    p.hands = [[deck.shift()!, deck.shift()!]];
    p.handBonuses = [0];
    p.activeHand = 0;
    p.stood = [false];
    p.outcomes = [null];
    p.results = [null];
    p.done = false;
  }
  room.deck = deck;
  room.dealer = dealer;
  room.phase = "playing";
  room.round += 1;
  room.updatedAt = Date.now();
  return room;
}

function advance(p: RoomPlayer): void {
  for (let i = p.activeHand + 1; i < p.hands.length; i += 1) {
    if (!p.stood[i]) {
      p.activeHand = i;
      return;
    }
  }
  p.done = true;
}

export type RoomAction = "hit" | "stand" | "double" | "split" | "gift";

export function applyAction(
  room: RoguelikeRoom,
  playerId: string,
  action: RoomAction,
  input: { targetId?: string; supportId?: SupportId } = {},
): { room: RoguelikeRoom; error?: string } {
  const p = room.players.find((x) => x.playerId === playerId);
  if (!p) return { room, error: "You are not in this room." };
  if (room.phase !== "playing") return { room, error: "The hand has not started." };
  if (p.eliminated) return { room, error: "You have been eliminated." };
  if (p.done) return { room, error: "You already finished this hand." };

  const hand = p.hands[p.activeHand];
  if (!hand) return { room, error: "No active hand." };

  if (action === "hit") {
    if (room.deck.length === 0) return { room, error: "Deck empty." };
    hand.push(room.deck.shift()!);
    const value = Math.max(0, computeHandValue(hand) + (p.handBonuses[p.activeHand] ?? 0));
    if (value > 21) {
      p.stood[p.activeHand] = true;
      p.results[p.activeHand] = { value, blackjack: false, charlie: false, bust: true };
      advance(p);
    }
  } else if (action === "stand") {
    p.stood[p.activeHand] = true;
    advance(p);
  } else if (action === "double") {
    if (hand.length !== 2) return { room, error: "Double down needs exactly 2 cards." };
    if (room.deck.length === 0) return { room, error: "Deck empty." };
    hand.push(room.deck.shift()!);
    p.stood[p.activeHand] = true;
    advance(p);
  } else if (action === "split") {
    if (p.hands.length !== 1) return { room, error: "You can only split once." };
    if (hand.length !== 2 || hand[0]!.rank !== hand[1]!.rank) return { room, error: "Split needs a pair." };
    if (room.deck.length < 2) return { room, error: "Deck empty." };
    const c1 = room.deck.shift()!;
    const c2 = room.deck.shift()!;
    p.hands = [
      [hand[0]!, c1],
      [hand[1]!, c2],
    ];
    p.handBonuses = [p.handBonuses[p.activeHand] ?? 0, 0];
    p.stood = [false, false];
    p.outcomes = [null, null];
    p.results = [null, null];
    p.activeHand = 0;
  } else if (action === "gift") {
    return applyGift(room, p, input);
  } else {
    return { room, error: "Unknown action." };
  }

  tryReveal(room);
  room.updatedAt = Date.now();
  return { room };
}

function applyGift(room: RoguelikeRoom, giver: RoomPlayer, input: { targetId?: string; supportId?: SupportId }): { room: RoguelikeRoom; error?: string } {
  const supportId = input.supportId as SupportId;
  if (!supportId || !SUPPORT[supportId]) return { room, error: "Unknown support powerup." };
  const count = giver.support[supportId] ?? 0;
  if (count <= 0) return { room, error: "No charges left of that support." };
  const target = room.players.find((x) => x.playerId === input.targetId);
  if (!target) return { room, error: "Target not in room." };
  if (target.eliminated) return { room, error: "Target is eliminated." };
  const thand = target.hands[target.activeHand];
  if (!thand) return { room, error: "Target has no active hand." };

  if (supportId === "add2") target.handBonuses[target.activeHand] = (target.handBonuses[target.activeHand] ?? 0) + 2;
  else if (supportId === "add1") target.handBonuses[target.activeHand] = (target.handBonuses[target.activeHand] ?? 0) + 1;
  else if (supportId === "sub2") target.handBonuses[target.activeHand] = (target.handBonuses[target.activeHand] ?? 0) - 2;
  else if (supportId === "draw") {
    if (room.deck.length === 0) return { room, error: "Deck empty." };
    thand.push(room.deck.shift()!);
  }

  giver.support[supportId] = count - 1;
  room.updatedAt = Date.now();
  return { room };
}

function tryReveal(room: RoguelikeRoom): void {
  if (room.phase !== "playing") return;
  const active = room.players.filter((p) => !p.eliminated);
  if (!active.every((p) => p.done)) return;

  let dealer = [...room.dealer];
  const deck = [...room.deck];
  while (computeHandValue(dealer) < 17 && deck.length > 0) {
    dealer.push(deck.shift()!);
  }
  room.dealer = dealer;
  room.deck = deck;

  const dealerValue = computeHandValue(dealer);
  const dealerBust = dealerValue > 21;

  for (const p of room.players) {
    if (p.eliminated) continue;
    for (let h = 0; h < p.hands.length; h += 1) {
      const hand = p.hands[h]!;
      const bonus = p.handBonuses[h] ?? 0;
      const value = Math.max(0, computeHandValue(hand) + bonus);
      const bust = value > 21;
      p.outcomes[h] = outcomeOf(value, bust, dealerValue, dealerBust);
      p.results[h] = {
        value,
        blackjack: isBlackjack(hand) && bonus === 0,
        charlie: hand.length >= 5 && value <= 21,
        bust,
      };
      if (p.outcomes[h] === "win") p.wins += 1;
    }
  }

  // Elimination: a player who lost their (last) hand is out.
  if (room.mode === "elimination") {
    for (const p of room.players) {
      if (p.eliminated) continue;
      const lastOutcome = p.outcomes[p.outcomes.length - 1] ?? null;
      if (lastOutcome === "lose") p.eliminated = true;
    }
  }

  room.phase = "reveal";

  // Auto-end: elimination leaves ≤1 survivor, or the round cap is hit.
  const survivors = room.players.filter((p) => !p.eliminated).length;
  if (room.round >= MAX_ROUNDS || (room.mode === "elimination" && survivors <= 1)) {
    finishRun(room);
  }
}

function finishRun(room: RoguelikeRoom): void {
  const survivors = room.players.filter((p) => !p.eliminated);
  const baseXp = 50 + room.round * 25;
  const xp: XpAward[] = [];

  if (room.mode === "coop") {
    const active = room.players.filter((p) => !p.eliminated);
    const share = Math.max(1, Math.round(baseXp / Math.max(1, active.length)));
    for (const p of active) xp.push({ playerId: p.playerId, username: p.username, amount: share });
  } else if (room.mode === "race") {
    const active = room.players.filter((p) => !p.eliminated);
    if (active.length === 0) {
      // nothing
    } else {
      const winner = active.slice().sort((a, b) => b.wins - a.wins)[0]!;
      const winnerShare = Math.round(baseXp * 0.6);
      const rest = active.length > 1 ? Math.max(1, Math.round((baseXp - winnerShare) / (active.length - 1))) : 0;
      for (const p of active) {
        if (p.playerId === winner.playerId) xp.push({ playerId: p.playerId, username: p.username, amount: winnerShare });
        else xp.push({ playerId: p.playerId, username: p.username, amount: rest });
      }
    }
  } else {
    // elimination: split among survivors
    const share = Math.max(1, Math.round(baseXp / Math.max(1, survivors.length)));
    for (const p of survivors) xp.push({ playerId: p.playerId, username: p.username, amount: share });
    // eliminated players get 0
    for (const p of room.players) {
      if (p.eliminated) xp.push({ playerId: p.playerId, username: p.username, amount: 0 });
    }
  }

  room.xp = xp;
  room.runEnded = true;
  room.updatedAt = Date.now();
}

export function nextRound(room: RoguelikeRoom): RoguelikeRoom {
  for (const p of room.players) {
    p.hands = [];
    p.handBonuses = [];
    p.activeHand = 0;
    p.stood = [];
    p.outcomes = [];
    p.results = [];
    p.done = false;
  }
  room.dealer = [];
  room.deck = [];
  room.phase = "lobby";
  room.updatedAt = Date.now();
  return room;
}

export function resetRoom(room: RoguelikeRoom): RoguelikeRoom {
  for (const p of room.players) {
    p.hands = [];
    p.handBonuses = [];
    p.activeHand = 0;
    p.stood = [];
    p.outcomes = [];
    p.results = [];
    p.done = false;
    p.eliminated = false;
    p.wins = 0;
    p.support = { add2: 2, add1: 2, sub2: 1, draw: 1 };
  }
  room.dealer = [];
  room.deck = [];
  room.phase = "lobby";
  room.round = 0;
  room.runEnded = false;
  room.xp = null;
  room.updatedAt = Date.now();
  return room;
}

// Writes any pending XP awards to linked accounts (no-op for anonymous players).
export async function persistRoomXp(room: RoguelikeRoom): Promise<void> {
  if (!room.runEnded || !room.xp) return;
  for (const award of room.xp) {
    if (award.amount <= 0) continue;
    const player = room.players.find((p) => p.playerId === award.playerId);
    if (player?.userId != null) {
      await addUserXp(player.userId, award.amount);
    }
  }
}

// Client-safe projection (hides the shoe and account ids).
export function roomView(room: RoguelikeRoom, playerId: string) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    phase: room.phase,
    round: room.round,
    dealer: room.dealer,
    players: room.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      hands: p.hands,
      handBonuses: p.handBonuses,
      activeHand: p.activeHand,
      stood: p.stood,
      outcomes: p.outcomes,
      results: p.results,
      done: p.done,
      eliminated: p.eliminated,
      wins: p.wins,
      support: p.support,
    })),
    deckCount: room.deck.length,
    youId: playerId,
    runEnded: room.runEnded,
    xp: room.xp,
    updatedAt: room.updatedAt,
  };
}

export async function loadRoom(code: string): Promise<RoguelikeRoom | null> {
  const row = await getRoguelikeRoom(code);
  if (!row) return null;
  const state = row.state as RoguelikeRoom;
  return { ...state, code } as RoguelikeRoom;
}

export async function saveRoom(room: RoguelikeRoom): Promise<void> {
  await upsertRoguelikeRoom(room.code, room);
}
