// Roguelike Blackjack — pure game logic (Balatro-inspired)
// Solo-first, run-based deckbuilder. No gambling terms anywhere.
// Single source of truth for all state transitions (solo + multiplayer).

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER"; // magic-joker wildcard, counts 0

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type Phase = "playing" | "shop" | "gameover" | "won";

export type JokerId =
  | "lucky_streak"
  | "blackjack_bonus"
  | "five_card_charlie"
  | "soft_touch"
  | "extra_deal"
  | "mulligan"
  | "high_roller"
  | "ace_up"
  | "scorer"
  | "bust_insurance";

export type ConsumableId =
  | "add_ace"
  | "add_ten"
  | "remove_low"
  | "transform_high"
  | "trim_deck";

// All 25 powerups ported from the standard blackjack game.
export type PowerupId =
  | "add2_self"
  | "add1_self"
  | "peek_next"
  | "bj_protector"
  | "free_split"
  | "swap_one"
  | "double_payout"
  | "remove_random_self"
  | "remove_card_self"
  | "add2_dealer"
  | "dealer_second_chance"
  | "add2_target"
  | "force_hit_target"
  | "add1_magic"
  | "add2_magic"
  | "sub1_self"
  | "sub2_self"
  | "sub5_self"
  | "sub10_self"
  | "magic_ace"
  | "magic_king"
  | "magic_queen"
  | "magic_jack"
  | "magic_joker"
  | "mythic_copy_hands";

export interface JokerDef {
  id: JokerId;
  name: string;
  desc: string;
  cost: number;
  rarity: "common" | "uncommon" | "rare";
  extraHands?: number;
  extraRedraws?: number;
  score?: (ctx: ScoreContext, score: number) => number;
  onAcquire?: (deck: Card[]) => Card[];
  onAcquireMessage?: string;
  forgivesBust?: boolean;
}

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  desc: string;
  cost: number;
  apply: (deck: Card[]) => { deck: Card[]; message: string };
}

export type PowerupRarity = "common" | "rare" | "legendary" | "mythic";

export interface PowerupDef {
  id: PowerupId;
  name: string;
  desc: string;
  cost: number;
  rarity: PowerupRarity;
  category: string;
  timing: "own_turn" | "betting" | "dealer_window" | "anytime";
  target: "self" | "dealer" | "any";
}

export interface ScoreContext {
  hand: Card[];
  handValue: number;
  isBlackjack: boolean;
  isCharlie: boolean;
  isBust: boolean;
  round: number;
}

export interface RunState {
  round: number;
  target: number;
  roundScore: number;
  handsRemaining: number;
  redrawsRemaining: number;
  deck: Card[];
  hand: Card[];
  splitHand: Card[] | null; // second hand after a split
  splitActive: boolean; // true while playing the second hand of a split
  dealer: Card[];
  dealerDone: boolean; // dealer already played out (frozen for split hand B)
  playing: boolean;
  handResult: HandResult | null;
  jokers: JokerId[];
  powerups: Partial<Record<PowerupId, number>>; // inventory of charges
  usedThisRound: PowerupId[]; // single-use-per-round tracking
  coins: number;
  stake: number; // current wager (double down / split)
  doubleDownArmed: boolean;
  wagerMult: number; // score multiplier from a risky play (double down = 2, split = 1.5)
  handBonus: number; // bonus/penalty points on the active player hand
  dealerBonus: number; // bonus/penalty points on the dealer
  peekCard: Card | null;
  bjProtected: boolean;
  doublePayoutArmed: boolean;
  dealerSecondChance: boolean;
  freeSplit: boolean;
  phase: Phase;
  difficulty: Difficulty;
  log: string[];
  lastOutcome: HandOutcome | null;
  lastDealerTotal: number;
}

export interface HandResult {
  value: number;
  score: number;
  blackjack: boolean;
  charlie: boolean;
  bust: boolean;
  cards: number;
}

export interface MetaState {
  bestRound: number;
  totalWins: number;
  runsPlayed: number;
  discoveredJokers: JokerId[];
  discoveredConsumables: ConsumableId[];
  discoveredPowerups: PowerupId[];
  unlockedDecks: string[];
  lastRunBestRound: number;
}

// ─────────────────────────────────────────────────────────────────────────────

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

const RANK_VALUE: Record<Rank, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
  JOKER: 0,
};

const LOW_RANKS: Rank[] = ["2", "3", "4", "5", "6"];

let cardCounter = 0;
function nextCardId() {
  cardCounter += 1;
  return `c${Date.now().toString(36)}_${cardCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeCard(rank: Rank, suit?: Suit): Card {
  return { id: nextCardId(), rank, suit: suit ?? SUITS[Math.floor(Math.random() * 4)]! };
}

function randomCard(): Card {
  return makeCard(RANKS[Math.floor(Math.random() * RANKS.length)]!);
}

export function buildStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: nextCardId(), rank, suit });
    }
  }
  return deck;
}

export function buildDeckForPreset(preset: string): Card[] {
  const base = buildStandardDeck();
  if (preset === "standard") return base;
  if (preset === "ace_heavy") {
    const toReplace = base.filter((c) => LOW_RANKS.includes(c.rank)).slice(0, 4);
    for (const card of toReplace) card.rank = "A";
    return base;
  }
  if (preset === "ten_heavy") {
    const toReplace = base.filter((c) => LOW_RANKS.includes(c.rank)).slice(0, 4);
    for (const card of toReplace) card.rank = "10";
    return base;
  }
  if (preset === "slim") {
    const removed = new Set(base.filter((c) => LOW_RANKS.includes(c.rank)).slice(0, 12).map((c) => c.id));
    return base.filter((c) => !removed.has(c.id));
  }
  return base;
}

export const DECK_PRESETS: Array<{ id: string; name: string; desc: string; unlockRound: number }> = [
  { id: "standard", name: "Standard Deck", desc: "The classic 52-card deck.", unlockRound: 1 },
  { id: "ace_heavy", name: "Ace Heavy", desc: "Four low cards become aces.", unlockRound: 3 },
  { id: "ten_heavy", name: "Ten Heavy", desc: "Four low cards become tens.", unlockRound: 5 },
  { id: "slim", name: "Slim Deck", desc: "Twelve low cards removed.", unlockRound: 7 },
];

// ── Hand valuation ──────────────────────────────────────────────────────────

export function computeHandValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") {
      aces += 1;
      total += 11;
    } else {
      total += RANK_VALUE[c.rank];
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

// Effective total including bonus/penalty points.
export function handTotal(cards: Card[], bonus: number): number {
  return Math.max(0, computeHandValue(cards) + bonus);
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && computeHandValue(cards) === 21;
}

export function isCharlie(cards: Card[]): boolean {
  return cards.length >= 5 && computeHandValue(cards) <= 21;
}

// ── House dealer ────────────────────────────────────────────────────────────

export type HandOutcome = "win" | "lose" | "push";

export function dealerDraws(deck: Card[], hand: Card[]): { deck: Card[]; hand: Card[] } {
  const d = [...deck];
  const h = [...hand];
  while (computeHandValue(h) < 17 && d.length > 0) {
    h.push(d.shift()!);
  }
  return { deck: d, hand: h };
}

export function outcomeOf(playerValue: number, playerBust: boolean, dealerValue: number, dealerBust: boolean): HandOutcome {
  if (playerBust) return "lose";
  if (dealerBust) return "win";
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}

// ── Jokers ───────────────────────────────────────────────────────────────────

export const JOKERS: JokerDef[] = [
  { id: "lucky_streak", name: "Lucky Streak", desc: "+8 points on every finished hand.", cost: 4, rarity: "common", score: (_ctx, score) => score + 8 },
  { id: "scorer", name: "Scorer", desc: "+2 points per card in a winning hand.", cost: 4, rarity: "common", score: (ctx, score) => (ctx.isBust ? score : score + ctx.hand.length * 2) },
  { id: "bust_insurance", name: "Bust Insurance", desc: "A busted hand still scores its card total.", cost: 4, rarity: "common", score: (ctx, score) => (ctx.isBust ? Math.max(score, ctx.handValue) : score) },
  { id: "high_roller", name: "High Roller", desc: "A hand that lands exactly on 21 scores 1.5×.", cost: 6, rarity: "uncommon", score: (ctx, score) => (!ctx.isBust && ctx.handValue === 21 ? Math.round(score * 1.5) : score) },
  { id: "blackjack_bonus", name: "Blackjack Bonus", desc: "Natural blackjack scores +40 extra.", cost: 6, rarity: "uncommon", score: (ctx, score) => (ctx.isBlackjack ? score + 40 : score) },
  { id: "five_card_charlie", name: "Five-Card Charlie", desc: "A 5+ card hand under 22 scores double.", cost: 7, rarity: "rare", score: (ctx, score) => (ctx.isCharlie ? score * 2 : score) },
  { id: "extra_deal", name: "Extra Deal", desc: "+1 hand per round.", cost: 6, rarity: "uncommon", extraHands: 1 },
  { id: "mulligan", name: "Mulligan", desc: "+1 redraw per round.", cost: 5, rarity: "common", extraRedraws: 1 },
  { id: "soft_touch", name: "Soft Touch", desc: "Once per hand, a bust is forgiven.", cost: 7, rarity: "rare", forgivesBust: true },
  { id: "ace_up", name: "Ace Up", desc: "Adds two aces to your deck.", cost: 5, rarity: "uncommon", onAcquire: (deck) => [...deck, makeCard("A"), makeCard("A")], onAcquireMessage: "Two aces added to your deck." },
];

export function getJoker(id: JokerId): JokerDef {
  const j = JOKERS.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown joker: ${id}`);
  return j;
}

// ── Consumables (deck editing) ──────────────────────────────────────────────

export const CONSUMABLES: ConsumableDef[] = [
  { id: "add_ace", name: "Add Ace", desc: "Adds an ace to your deck.", cost: 3, apply: (deck) => ({ deck: [...deck, makeCard("A")], message: "Ace added." }) },
  { id: "add_ten", name: "Add Ten", desc: "Adds a ten to your deck.", cost: 3, apply: (deck) => ({ deck: [...deck, makeCard("10")], message: "Ten added." }) },
  {
    id: "remove_low",
    name: "Remove Low",
    desc: "Removes a random low card (2–6).",
    cost: 3,
    apply: (deck) => {
      const idx = deck.findIndex((c) => LOW_RANKS.includes(c.rank));
      if (idx < 0) return { deck, message: "No low cards left." };
      const copy = [...deck];
      copy.splice(idx, 1);
      return { deck: copy, message: "Low card removed." };
    },
  },
  {
    id: "transform_high",
    name: "Transform High",
    desc: "Turns a random low card into a ten or ace.",
    cost: 4,
    apply: (deck) => {
      const idx = deck.findIndex((c) => LOW_RANKS.includes(c.rank));
      if (idx < 0) return { deck, message: "No low cards to transform." };
      const copy = [...deck];
      const newRank: Rank = Math.random() < 0.5 ? "10" : "A";
      copy[idx] = { ...copy[idx]!, rank: newRank };
      return { deck: copy, message: `Card transformed into ${newRank}.` };
    },
  },
  {
    id: "trim_deck",
    name: "Trim Deck",
    desc: "Removes a random card (thinner deck).",
    cost: 4,
    apply: (deck) => {
      if (deck.length <= 1) return { deck, message: "Deck is already minimal." };
      const idx = Math.floor(Math.random() * deck.length);
      const copy = [...deck];
      copy.splice(idx, 1);
      return { deck: copy, message: "Card removed." };
    },
  },
];

export function getConsumable(id: ConsumableId): ConsumableDef {
  const c = CONSUMABLES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown consumable: ${id}`);
  return c;
}

// ── Powerups (ported from standard blackjack) ───────────────────────────────

export const POWERUPS: PowerupDef[] = [
  { id: "add2_self", name: "+2 Points", desc: "Add +2 to your hand total.", cost: 3, rarity: "common", category: "boosts", timing: "own_turn", target: "self" },
  { id: "add1_self", name: "+1 Point", desc: "Add +1 to your hand total.", cost: 2, rarity: "common", category: "boosts", timing: "own_turn", target: "self" },
  { id: "sub1_self", name: "-1 (Save)", desc: "Subtract 1 from your total. Can save a bust.", cost: 2, rarity: "common", category: "saves", timing: "own_turn", target: "self" },
  { id: "sub2_self", name: "-2 (Save)", desc: "Subtract 2 from your total. Can save a bust.", cost: 3, rarity: "common", category: "saves", timing: "own_turn", target: "self" },
  { id: "sub5_self", name: "-5 (Save)", desc: "Subtract 5 from your total.", cost: 5, rarity: "rare", category: "saves", timing: "own_turn", target: "self" },
  { id: "sub10_self", name: "-10 (Save)", desc: "Subtract 10 from your total.", cost: 8, rarity: "legendary", category: "saves", timing: "own_turn", target: "self" },
  { id: "peek_next", name: "Peek", desc: "See the next card in the deck.", cost: 3, rarity: "common", category: "utility", timing: "own_turn", target: "self" },
  { id: "swap_one", name: "Swap", desc: "Replace your last card with the next deck card.", cost: 5, rarity: "rare", category: "utility", timing: "own_turn", target: "self" },
  { id: "remove_random_self", name: "Remove Random", desc: "Remove a random card from your hand.", cost: 5, rarity: "rare", category: "utility", timing: "own_turn", target: "self" },
  { id: "remove_card_self", name: "Remove Card", desc: "Remove a chosen card from your hand.", cost: 8, rarity: "legendary", category: "utility", timing: "own_turn", target: "self" },
  { id: "bj_protector", name: "BJ Protector", desc: "If the house gets blackjack, push instead of lose.", cost: 5, rarity: "rare", category: "protection", timing: "betting", target: "self" },
  { id: "free_split", name: "Free Split", desc: "Split any two cards (even if ranks differ).", cost: 8, rarity: "legendary", category: "utility", timing: "anytime", target: "self" },
  { id: "double_payout", name: "Double Payout", desc: "Double your coin payout if you win this hand.", cost: 4, rarity: "common", category: "payout", timing: "betting", target: "self" },
  { id: "add2_dealer", name: "House +2", desc: "Add +2 to the house total.", cost: 4, rarity: "rare", category: "dealer", timing: "dealer_window", target: "dealer" },
  { id: "dealer_second_chance", name: "House Second Chance", desc: "If the house busts, drop its total by 10.", cost: 8, rarity: "legendary", category: "dealer", timing: "dealer_window", target: "dealer" },
  { id: "add2_target", name: "Target +2", desc: "Add +2 to the house total (solo: opponent).", cost: 4, rarity: "common", category: "dealer", timing: "anytime", target: "any" },
  { id: "force_hit_target", name: "Force Hit", desc: "Force the house to draw a card.", cost: 5, rarity: "rare", category: "dealer", timing: "anytime", target: "any" },
  { id: "add1_magic", name: "+1 Magic", desc: "Summon a random card into your hand.", cost: 5, rarity: "rare", category: "magic", timing: "anytime", target: "any" },
  { id: "add2_magic", name: "+2 Magic", desc: "Summon two random cards into your hand.", cost: 8, rarity: "legendary", category: "magic", timing: "anytime", target: "any" },
  { id: "magic_ace", name: "Magic Ace", desc: "Summon an Ace into your hand.", cost: 8, rarity: "legendary", category: "magic", timing: "anytime", target: "any" },
  { id: "magic_king", name: "Magic King", desc: "Summon a King into your hand.", cost: 8, rarity: "legendary", category: "magic", timing: "anytime", target: "any" },
  { id: "magic_queen", name: "Magic Queen", desc: "Summon a Queen into your hand.", cost: 8, rarity: "legendary", category: "magic", timing: "anytime", target: "any" },
  { id: "magic_jack", name: "Magic Jack", desc: "Summon a Jack into your hand.", cost: 8, rarity: "legendary", category: "magic", timing: "anytime", target: "any" },
  { id: "magic_joker", name: "Magic Joker", desc: "Summon a Joker (counts 0) into your hand.", cost: 12, rarity: "mythic", category: "magic", timing: "anytime", target: "any" },
  { id: "mythic_copy_hands", name: "Copy Hands", desc: "Mirror the house hand into your own.", cost: 12, rarity: "mythic", category: "mythic", timing: "anytime", target: "any" },
];

export function getPowerup(id: PowerupId): PowerupDef {
  const p = POWERUPS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown powerup: ${id}`);
  return p;
}

export function powerupRarityColor(rarity: PowerupRarity): string {
  if (rarity === "mythic") return "rgba(255,150,50,.8)";
  if (rarity === "legendary") return "rgba(176,124,255,.75)";
  if (rarity === "rare") return "rgba(77,166,255,.6)";
  return "rgba(255,255,255,.22)";
}

// Applies a powerup to the current state. Returns new state + message, or an error.
export function usePowerup(
  state: RunState,
  id: PowerupId,
  opts: { cardIndex?: number } = {},
): { state: RunState; message: string } | { error: string } {
  const def = getPowerup(id);
  const count = state.powerups[id] ?? 0;
  if (count <= 0) return { error: "No charges left." };
  if (state.usedThisRound.includes(id)) return { error: "Already used this round." };
  if (!state.playing) return { error: "Use this during a hand." };

  const s: RunState = { ...state };
  let message = `${def.name} used.`;

  switch (id) {
    case "add2_self":
      s.handBonus += 2;
      break;
    case "add1_self":
      s.handBonus += 1;
      break;
    case "sub1_self":
      s.handBonus -= 1;
      break;
    case "sub2_self":
      s.handBonus -= 2;
      break;
    case "sub5_self":
      s.handBonus -= 5;
      break;
    case "sub10_self":
      s.handBonus -= 10;
      break;
    case "peek_next":
      s.peekCard = s.deck[0] ?? null;
      message = s.peekCard ? `Next card: ${s.peekCard.rank}${s.peekCard.suit}` : "Deck empty.";
      break;
    case "swap_one": {
      if (s.hand.length === 0) return { error: "No cards to swap." };
      if (s.deck.length === 0) return { error: "Deck empty." };
      const newCard = s.deck.shift()!;
      s.hand = [...s.hand];
      s.hand[s.hand.length - 1] = newCard;
      message = "Swapped your last card.";
      break;
    }
    case "remove_random_self": {
      if (s.hand.length === 0) return { error: "No cards to remove." };
      const idx = Math.floor(Math.random() * s.hand.length);
      s.hand = s.hand.filter((_, i) => i !== idx);
      message = "Removed a random card.";
      break;
    }
    case "remove_card_self": {
      const idx = opts.cardIndex ?? -1;
      if (idx < 0 || idx >= s.hand.length) return { error: "Choose a card to remove." };
      s.hand = s.hand.filter((_, i) => i !== idx);
      message = "Card removed.";
      break;
    }
    case "bj_protector":
      s.bjProtected = true;
      message = "Blackjack protection armed.";
      break;
    case "free_split":
      s.freeSplit = true;
      message = "You may now split any hand.";
      break;
    case "double_payout":
      s.doublePayoutArmed = true;
      message = "Payout will be doubled.";
      break;
    case "add2_dealer":
      s.dealerBonus += 2;
      break;
    case "dealer_second_chance":
      s.dealerSecondChance = true;
      message = "House second chance armed.";
      break;
    case "add2_target":
      s.dealerBonus += 2;
      message = "House total +2.";
      break;
    case "force_hit_target": {
      if (s.deck.length === 0) return { error: "Deck empty." };
      s.dealer = [...s.dealer, s.deck.shift()!];
      message = "House forced to draw.";
      break;
    }
    case "add1_magic":
      s.hand = [...s.hand, randomCard()];
      message = "Summoned a card.";
      break;
    case "add2_magic":
      s.hand = [...s.hand, randomCard(), randomCard()];
      message = "Summoned two cards.";
      break;
    case "magic_ace":
      s.hand = [...s.hand, makeCard("A")];
      message = "Summoned an Ace.";
      break;
    case "magic_king":
      s.hand = [...s.hand, makeCard("K")];
      message = "Summoned a King.";
      break;
    case "magic_queen":
      s.hand = [...s.hand, makeCard("Q")];
      message = "Summoned a Queen.";
      break;
    case "magic_jack":
      s.hand = [...s.hand, makeCard("J")];
      message = "Summoned a Jack.";
      break;
    case "magic_joker":
      s.hand = [...s.hand, makeCard("JOKER")];
      message = "Summoned a Joker.";
      break;
    case "mythic_copy_hands":
      s.hand = [...s.dealer];
      s.handBonus = 0;
      message = "You mirror the house hand.";
      break;
    default:
      return { error: "Unknown powerup." };
  }

  s.powerups = { ...s.powerups, [id]: count - 1 };
  s.usedThisRound = [...s.usedThisRound, id];
  s.log = [...s.log, message];
  return { state: s, message };
}

// ── Round structure ─────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  id: Difficulty;
  name: string;
  desc: string;
  startCoins: number;
  extraHands: number;
  extraRedraws: number;
  targetMult: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  { id: "easy", name: "Easy", desc: "More hands, lower targets.", startCoins: 7, extraHands: 1, extraRedraws: 1, targetMult: 0.8 },
  { id: "medium", name: "Medium", desc: "The standard challenge.", startCoins: 5, extraHands: 0, extraRedraws: 0, targetMult: 1 },
  { id: "hard", name: "Hard", desc: "Higher targets, fewer coins.", startCoins: 4, extraHands: 0, extraRedraws: 0, targetMult: 1.3 },
];

export function difficultyConfig(d: Difficulty): DifficultyConfig {
  return DIFFICULTIES.find((x) => x.id === d) ?? DIFFICULTIES[1]!;
}

export function targetForRound(round: number): number {
  return 25 + (round - 1) * 20;
}

export function targetForRun(round: number, difficulty: Difficulty): number {
  return Math.round(targetForRound(round) * difficultyConfig(difficulty).targetMult);
}

export function baseHandsPerRound(): number {
  return 3;
}

export function baseRedrawsPerRound(): number {
  return 1;
}

export function handsForRun(state: RunState): number {
  const bonus = state.jokers.reduce((sum, id) => sum + (getJoker(id).extraHands ?? 0), 0);
  return baseHandsPerRound() + difficultyConfig(state.difficulty).extraHands + bonus;
}

export function redrawsForRun(state: RunState): number {
  const bonus = state.jokers.reduce((sum, id) => sum + (getJoker(id).extraRedraws ?? 0), 0);
  return baseRedrawsPerRound() + difficultyConfig(state.difficulty).extraRedraws + bonus;
}

export function coinsForWin(round: number, overkill: number): number {
  return 5 + round * 3 + Math.floor(overkill / 25);
}

// ── Score a finished hand ───────────────────────────────────────────────────

export function scoreHand(state: RunState, hand: Card[]): HandResult {
  const rawValue = computeHandValue(hand);
  const value = Math.max(0, rawValue + state.handBonus);
  const blackjack = isBlackjack(hand) && state.handBonus === 0;
  const charlie = hand.length >= 5 && value <= 21;
  const bust = value > 21;

  let score = bust ? 0 : blackjack ? 51 : charlie ? 46 : value;

  const ctx: ScoreContext = { hand, handValue: value, isBlackjack: blackjack, isCharlie: charlie, isBust: bust, round: state.round };
  for (const id of state.jokers) {
    const j = getJoker(id);
    if (j.score) score = j.score(ctx, score);
  }
  return { value, score, blackjack, charlie, bust, cards: hand.length };
}

// ── Core resolution ─────────────────────────────────────────────────────────

interface DealerResolution {
  deck: Card[];
  dealer: Card[];
  dealerTotal: number;
  dealerBust: boolean;
  dealerNatural: boolean;
}

function resolveDealer(state: RunState): DealerResolution {
  let deck = [...state.deck];
  let dealer = [...state.dealer];
  if (!state.dealerDone) {
    while (computeHandValue(dealer) < 17 && deck.length > 0) {
      dealer.push(deck.shift()!);
    }
  }
  const dealerNatural = dealer.length === 2 && computeHandValue(dealer) === 21;
  let dealerTotal = Math.max(0, computeHandValue(dealer) + state.dealerBonus);
  let dealerBust = dealerTotal > 21;
  if (dealerBust && state.dealerSecondChance) {
    dealerTotal -= 10;
    if (dealerTotal <= 21) dealerBust = false;
  }
  return { deck, dealer, dealerTotal, dealerBust, dealerNatural };
}

// Finalizes a hand: plays the house, scores, adjusts coins, handles split flow, transitions phase.
function finishHandState(state: RunState, handCards: Card[]): RunState {
  const playerRaw = computeHandValue(handCards);
  const playerTotal = Math.max(0, playerRaw + state.handBonus);
  const playerBust = playerTotal > 21;

  const { deck, dealer, dealerTotal, dealerBust, dealerNatural } = resolveDealer(state);

  let outcome = outcomeOf(playerTotal, playerBust, dealerTotal, dealerBust);
  if (outcome === "lose" && dealerNatural && state.bjProtected) outcome = "push";

  let result = scoreHand(state, handCards);
  if (outcome === "win" && state.wagerMult > 1) result = { ...result, score: Math.round(result.score * state.wagerMult) };

  let coinDelta = 0;
  if (state.stake > 0) {
    if (outcome === "win") coinDelta = state.stake * (state.doublePayoutArmed ? 2 : 1);
    else if (outcome === "lose") coinDelta = -state.stake;
  }

  const points = outcome === "win" ? result.score : 0;

  const next: RunState = {
    ...state,
    deck,
    dealer,
    dealerDone: true,
    playing: false,
    handResult: result,
    roundScore: state.roundScore + points,
    coins: Math.max(0, state.coins + coinDelta),
    handBonus: 0,
    peekCard: null,
    doubleDownArmed: false,
    stake: state.splitHand ? state.stake : 0,
    lastOutcome: outcome,
    lastDealerTotal: dealerTotal,
  };

  // Split hand A just resolved → continue to hand B (dealer stays frozen).
  if (state.splitHand && !state.splitActive) {
    return {
      ...next,
      hand: state.splitHand,
      splitHand: null,
      splitActive: true,
      playing: true,
      handResult: null,
      log: [...next.log, "Split — now playing your second hand."],
    };
  }

  return finalizeRound(next);
}

function finalizeRound(state: RunState): RunState {
  if (state.roundScore >= state.target) {
    const overkill = state.roundScore - state.target;
    const gained = coinsForWin(state.round, overkill);
    return { ...state, phase: "shop", coins: state.coins + gained, log: [...state.log, `Round ${state.round} cleared! +${gained} coins`] };
  }
  if (state.handsRemaining <= 0) {
    return { ...state, phase: "gameover" };
  }
  return state;
}

// ── Run factory / state transitions ─────────────────────────────────────────

export function newRun(preset: string, difficulty: Difficulty = "medium"): RunState {
  const deck = shuffle(buildDeckForPreset(preset));
  const cfg = difficultyConfig(difficulty);
  return {
    round: 1,
    target: targetForRun(1, difficulty),
    roundScore: 0,
    handsRemaining: baseHandsPerRound() + cfg.extraHands,
    redrawsRemaining: baseRedrawsPerRound() + cfg.extraRedraws,
    deck,
    hand: [],
    splitHand: null,
    splitActive: false,
    dealer: [],
    dealerDone: false,
    playing: false,
    handResult: null,
    jokers: [],
    powerups: {},
    usedThisRound: [],
    coins: cfg.startCoins,
    stake: 0,
    doubleDownArmed: false,
    wagerMult: 1,
    handBonus: 0,
    dealerBonus: 0,
    peekCard: null,
    bjProtected: false,
    doublePayoutArmed: false,
    dealerSecondChance: false,
    freeSplit: false,
    phase: "playing",
    difficulty,
    log: [],
    lastOutcome: null,
    lastDealerTotal: 0,
  };
}

function resetHandFlags(state: RunState): RunState {
  return {
    ...state,
    handBonus: 0,
    dealerBonus: 0,
    peekCard: null,
    bjProtected: false,
    doublePayoutArmed: false,
    dealerSecondChance: false,
    freeSplit: false,
    splitHand: null,
    splitActive: false,
    dealerDone: false,
    stake: 0,
    doubleDownArmed: false,
    wagerMult: 1,
    lastOutcome: null,
    lastDealerTotal: 0,
  };
}

export function deal(state: RunState): RunState {
  if (state.phase !== "playing" || state.playing || state.handsRemaining <= 0) return state;
  let deck = [...state.deck];
  if (deck.length < 4) deck = shuffle(buildStandardDeck());
  const hand: Card[] = [deck.shift()!, deck.shift()!];
  const dealer: Card[] = [deck.shift()!, deck.shift()!];
  return {
    ...resetHandFlags(state),
    deck,
    hand,
    dealer,
    playing: true,
    handsRemaining: state.handsRemaining - 1,
    handResult: null,
  };
}

export function hit(state: RunState): RunState {
  if (!state.playing) return state;
  let deck = [...state.deck];
  if (deck.length === 0) deck = shuffle(buildStandardDeck());
  const card = deck.shift()!;
  const hand = [...state.hand, card];
  const total = handTotal(hand, state.handBonus);
  if (total > 21) {
    if (state.jokers.includes("soft_touch")) {
      const saved = hand.slice(0, -1);
      return finishHandState({ ...state, deck, log: [...state.log, "Soft Touch saved the bust."] }, saved);
    }
    return finishHandState({ ...state, deck }, hand);
  }
  return { ...state, deck, hand };
}

export function stand(state: RunState): RunState {
  if (!state.playing) return state;
  return finishHandState(state, state.hand);
}

export function doubleDown(state: RunState): RunState {
  if (!state.playing || state.hand.length !== 2) return state;
  const stake = Math.max(1, Math.floor(state.coins / 2));
  let deck = [...state.deck];
  if (deck.length === 0) deck = shuffle(buildStandardDeck());
  const card = deck.shift()!;
  const hand = [...state.hand, card];
  return finishHandState({ ...state, deck, stake, doubleDownArmed: true, wagerMult: 2, log: [...state.log, `Doubled down for ${stake} coins.`] }, hand);
}

export function split(state: RunState): RunState {
  if (!state.playing || state.hand.length !== 2) return state;
  const [a, b] = state.hand;
  if (!state.freeSplit && a!.rank !== b!.rank) return state;
  const stake = Math.max(1, Math.floor(state.coins / 2));
  let deck = [...state.deck];
  if (deck.length < 2) deck = shuffle(buildStandardDeck());
  const c1 = deck.shift()!;
  const c2 = deck.shift()!;
  return {
    ...state,
    deck,
    hand: [a!, c1],
    splitHand: [b!, c2],
    splitActive: false,
    stake,
    wagerMult: 1.5,
    dealerDone: false,
    handBonus: 0,
    handResult: null,
    log: [...state.log, `Split for ${stake} coins per hand.`],
  };
}

export function redraw(state: RunState): RunState {
  if (!state.playing || state.redrawsRemaining <= 0) return state;
  let deck = [...state.deck];
  if (deck.length < 2) deck = shuffle(buildStandardDeck());
  const hand: Card[] = [deck.shift()!, deck.shift()!];
  return {
    ...state,
    deck,
    hand,
    redrawsRemaining: state.redrawsRemaining - 1,
    handBonus: 0,
    peekCard: null,
    handResult: null,
    log: [...state.log, "Hand redrawn."],
  };
}

export function startNextRound(state: RunState): RunState {
  const round = state.round + 1;
  return {
    ...resetHandFlags(state),
    round,
    target: targetForRun(round, state.difficulty),
    roundScore: 0,
    handsRemaining: handsForRun(state),
    redrawsRemaining: redrawsForRun(state),
    hand: [],
    dealer: [],
    playing: false,
    handResult: null,
    usedThisRound: [],
    phase: "playing",
    log: [...state.log, `Round ${round} begins. Target: ${targetForRun(round, state.difficulty)}.`],
  };
}

export function buyJoker(state: RunState, id: JokerId): RunState {
  const def = getJoker(id);
  if (state.coins < def.cost || state.jokers.includes(id)) return state;
  let deck = state.deck;
  const log = [...state.log];
  if (def.onAcquire) {
    deck = def.onAcquire(deck);
    if (def.onAcquireMessage) log.push(def.onAcquireMessage);
  }
  return { ...state, coins: state.coins - def.cost, jokers: [...state.jokers, id], deck, log: [...log, `Bought ${def.name}.`] };
}

export function buyConsumable(state: RunState, id: ConsumableId): RunState {
  const def = getConsumable(id);
  if (state.coins < def.cost) return state;
  const { deck, message } = def.apply(state.deck);
  return { ...state, coins: state.coins - def.cost, deck, log: [...state.log, message] };
}

export function buyPowerup(state: RunState, id: PowerupId): RunState {
  const def = getPowerup(id);
  if (state.coins < def.cost) return state;
  return {
    ...state,
    coins: state.coins - def.cost,
    powerups: { ...state.powerups, [id]: (state.powerups[id] ?? 0) + 1 },
    log: [...state.log, `Bought ${def.name}.`],
  };
}

function draw(deck: Card[]): Card {
  return deck.shift()!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Meta persistence (localStorage) ─────────────────────────────────────────

const META_KEY = "lgc.bjroguelike.meta.v1";

export function loadMeta(): MetaState {
  const fallback: MetaState = {
    bestRound: 0,
    totalWins: 0,
    runsPlayed: 0,
    discoveredJokers: [],
    discoveredConsumables: [],
    discoveredPowerups: [],
    unlockedDecks: ["standard"],
    lastRunBestRound: 0,
  };
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function recordRunEnd(meta: MetaState, bestRoundThisRun: number): MetaState {
  const unlockedDecks = [...meta.unlockedDecks];
  for (const preset of DECK_PRESETS) {
    if (bestRoundThisRun >= preset.unlockRound && !unlockedDecks.includes(preset.id)) {
      unlockedDecks.push(preset.id);
    }
  }
  return {
    ...meta,
    bestRound: Math.max(meta.bestRound, bestRoundThisRun),
    lastRunBestRound: bestRoundThisRun,
    runsPlayed: meta.runsPlayed + 1,
    unlockedDecks,
  };
}

export function recordRoundWin(meta: MetaState, round: number): MetaState {
  return {
    ...meta,
    totalWins: meta.totalWins + 1,
    bestRound: Math.max(meta.bestRound, round),
    lastRunBestRound: Math.max(meta.lastRunBestRound, round),
  };
}

export function recordDiscoveries(state: RunState, meta: MetaState): MetaState {
  const discoveredJokers = [...meta.discoveredJokers];
  for (const id of state.jokers) {
    if (!discoveredJokers.includes(id)) discoveredJokers.push(id);
  }
  const discoveredPowerups = [...meta.discoveredPowerups];
  for (const id of Object.keys(state.powerups) as PowerupId[]) {
    if ((state.powerups[id] ?? 0) > 0 && !discoveredPowerups.includes(id)) discoveredPowerups.push(id);
  }
  return { ...meta, discoveredJokers, discoveredPowerups };
}

export function cardColor(card: Card): string {
  if (card.rank === "JOKER") return "#ffd24a";
  return card.suit === "♥" || card.suit === "♦" ? "#ff5d8f" : "#eaf6ff";
}
