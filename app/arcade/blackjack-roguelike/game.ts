// Roguelike Blackjack — pure game logic (Balatro-inspired)
// Solo-first, run-based deckbuilder. No gambling terms anywhere.

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
  | "K";

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

export interface JokerDef {
  id: JokerId;
  name: string;
  desc: string;
  cost: number;
  rarity: "common" | "uncommon" | "rare";
  // Flags that alter round structure (read before/independent of hand scoring).
  extraHands?: number;
  extraRedraws?: number;
  // Applied during scoring of a finished hand (flat points / simple effects).
  score?: (ctx: ScoreContext, score: number) => number;
  // Applied once when the joker is acquired (deck editing / immediate effects).
  onAcquire?: (deck: Card[]) => Card[];
  onAcquireMessage?: string;
  // Applied during play (e.g. soft touch forgives one bust).
  forgivesBust?: boolean;
}

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  desc: string;
  cost: number;
  apply: (deck: Card[]) => { deck: Card[]; message: string };
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
  dealer: Card[];
  playing: boolean; // whether we are mid-hand (cards dealt, not yet resolved)
  handResult: HandResult | null;
  jokers: JokerId[];
  coins: number;
  phase: Phase;
  difficulty: Difficulty;
  log: string[];
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
};

const LOW_RANKS: Rank[] = ["2", "3", "4", "5", "6"];

let cardCounter = 0;
function nextCardId() {
  cardCounter += 1;
  return `c${Date.now().toString(36)}_${cardCounter}_${Math.random().toString(36).slice(2, 6)}`;
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
    // Replace four low cards with four aces.
    const toReplace = base.filter((c) => LOW_RANKS.includes(c.rank)).slice(0, 4);
    for (const card of toReplace) {
      card.rank = "A";
    }
    return base;
  }
  if (preset === "ten_heavy") {
    const toReplace = base.filter((c) => LOW_RANKS.includes(c.rank)).slice(0, 4);
    for (const card of toReplace) {
      card.rank = "10";
    }
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

// ── Hand valuation (aces soft/hard, maximize value ≤ 21) ────────────────────

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
  // Downgrade aces from 11 to 1 until ≤ 21 or out of aces.
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && computeHandValue(cards) === 21;
}

export function isCharlie(cards: Card[]): boolean {
  return cards.length >= 5 && computeHandValue(cards) <= 21;
}

// ── House dealer ────────────────────────────────────────────────────────────

export type HandOutcome = "win" | "lose" | "push";

// Standard house rule: dealer draws until their total is 17 or higher.
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
  {
    id: "lucky_streak",
    name: "Lucky Streak",
    desc: "+8 points on every finished hand.",
    cost: 4,
    rarity: "common",
    score: (_ctx, score) => score + 8,
  },
  {
    id: "scorer",
    name: "Scorer",
    desc: "+2 points per card in a winning hand.",
    cost: 4,
    rarity: "common",
    score: (ctx, score) => (ctx.isBust ? score : score + ctx.hand.length * 2),
  },
  {
    id: "bust_insurance",
    name: "Bust Insurance",
    desc: "A busted hand still scores its card total.",
    cost: 4,
    rarity: "common",
    score: (ctx, score) => (ctx.isBust ? Math.max(score, ctx.handValue) : score),
  },
  {
    id: "high_roller",
    name: "High Roller",
    desc: "A hand that lands exactly on 21 scores 1.5×.",
    cost: 6,
    rarity: "uncommon",
    score: (ctx, score) => (!ctx.isBust && ctx.handValue === 21 ? Math.round(score * 1.5) : score),
  },
  {
    id: "blackjack_bonus",
    name: "Blackjack Bonus",
    desc: "Natural blackjack scores +40 extra.",
    cost: 6,
    rarity: "uncommon",
    score: (ctx, score) => (ctx.isBlackjack ? score + 40 : score),
  },
  {
    id: "five_card_charlie",
    name: "Five-Card Charlie",
    desc: "A 5+ card hand under 22 scores double.",
    cost: 7,
    rarity: "rare",
    score: (ctx, score) => (ctx.isCharlie ? score * 2 : score),
  },
  {
    id: "extra_deal",
    name: "Extra Deal",
    desc: "+1 hand per round.",
    cost: 6,
    rarity: "uncommon",
    extraHands: 1,
  },
  {
    id: "mulligan",
    name: "Mulligan",
    desc: "+1 redraw per round.",
    cost: 5,
    rarity: "common",
    extraRedraws: 1,
  },
  {
    id: "soft_touch",
    name: "Soft Touch",
    desc: "Once per hand, a bust is forgiven.",
    cost: 7,
    rarity: "rare",
    forgivesBust: true,
  },
  {
    id: "ace_up",
    name: "Ace Up",
    desc: "Adds two aces to your deck.",
    cost: 5,
    rarity: "uncommon",
    onAcquire: (deck) => [...deck, { id: nextCardId(), rank: "A", suit: "♠" }, { id: nextCardId(), rank: "A", suit: "♥" }],
    onAcquireMessage: "Two aces added to your deck.",
  },
];

export function getJoker(id: JokerId): JokerDef {
  const j = JOKERS.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown joker: ${id}`);
  return j;
}

// ── Consumables (deck editing) ──────────────────────────────────────────────

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: "add_ace",
    name: "Add Ace",
    desc: "Adds an ace to your deck.",
    cost: 3,
    apply: (deck) => ({ deck: [...deck, { id: nextCardId(), rank: "A", suit: SUITS[Math.floor(Math.random() * 4)]! }], message: "Ace added." }),
  },
  {
    id: "add_ten",
    name: "Add Ten",
    desc: "Adds a ten to your deck.",
    cost: 3,
    apply: (deck) => ({ deck: [...deck, { id: nextCardId(), rank: "10", suit: SUITS[Math.floor(Math.random() * 4)]! }], message: "Ten added." }),
  },
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
  const value = computeHandValue(hand);
  const blackjack = isBlackjack(hand);
  const charlie = isCharlie(hand);
  const bust = value > 21;

  let score = bust ? 0 : blackjack ? 51 : charlie ? 46 : value;

  const ctx: ScoreContext = { hand, handValue: value, isBlackjack: blackjack, isCharlie: charlie, isBust: bust, round: state.round };
  for (const id of state.jokers) {
    const j = getJoker(id);
    if (j.score) score = j.score(ctx, score);
  }
  return { value, score, blackjack, charlie, bust, cards: hand.length };
}

// ── Run factory / mutations ─────────────────────────────────────────────────

export function newRun(preset: string, difficulty: Difficulty = "medium"): RunState {
  const deck = shuffle(buildDeckForPreset(preset));
  const cfg = difficultyConfig(difficulty);
  const state: RunState = {
    round: 1,
    target: targetForRun(1, difficulty),
    roundScore: 0,
    handsRemaining: baseHandsPerRound() + cfg.extraHands,
    redrawsRemaining: baseRedrawsPerRound() + cfg.extraRedraws,
    deck,
    hand: [],
    dealer: [],
    playing: false,
    handResult: null,
    jokers: [],
    coins: cfg.startCoins,
    phase: "playing",
    difficulty,
    log: [],
  };
  return state;
}

export function dealHand(state: RunState): RunState {
  if (state.handsRemaining <= 0) return state;
  const deck = [...state.deck];
  const hand: Card[] = [];
  if (deck.length < 2) {
    // Reshuffle discards implicitly by rebuilding from the full standard deck.
    return { ...state, deck: shuffle(buildStandardDeck()), hand: [], playing: false, log: ["Deck reshuffled."] };
  }
  hand.push(draw(deck), draw(deck));
  return { ...state, deck, hand, playing: true, handResult: null, handsRemaining: state.handsRemaining - 1 };
}

export function hit(state: RunState): RunState {
  if (!state.playing) return state;
  if (state.deck.length === 0) {
    return { ...state, deck: shuffle(buildStandardDeck()), log: ["Deck reshuffled."] };
  }
  const deck = [...state.deck];
  const card = draw(deck);
  const hand = [...state.hand, card];
  const value = computeHandValue(hand);
  if (value > 21) {
    // Check soft touch joker (forgives one bust per hand).
    if (state.jokers.includes("soft_touch")) {
      // Remove the busting card and stop forcing — treat as a stand.
      const withoutBust = hand.slice(0, -1);
      const result = scoreHand(state, withoutBust);
      return { ...state, deck, hand: withoutBust, playing: false, handResult: result, log: [...state.log, "Soft Touch saved the bust."] };
    }
    const result = scoreHand(state, hand);
    return { ...state, deck, hand, playing: false, handResult: result };
  }
  return { ...state, deck, hand };
}

export function stand(state: RunState): RunState {
  if (!state.playing) return state;
  const result = scoreHand(state, state.hand);
  return { ...state, playing: false, handResult: result };
}

export function resolveHand(state: RunState): RunState {
  // Called after a hand is finished (stand/bust) to bank the score.
  const result = state.handResult;
  if (!result) return state;
  const roundScore = state.roundScore + result.score;
  const log = [...state.log, `Hand scored ${result.score} points.`];
  const next: RunState = { ...state, roundScore, hand: [], handResult: null, log };

  if (roundScore >= state.target) {
    return { ...next, phase: "shop", coins: next.coins + coinsForWin(state.round, roundScore - state.target), log: [...next.log, "Round cleared!"] };
  }
  if (next.handsRemaining <= 0) {
    return { ...next, phase: "gameover" };
  }
  return next;
}

export function mulligan(state: RunState): RunState {
  if (!state.playing) return state;
  if (state.redrawsRemaining <= 0) return state;
  const deck = [...state.deck];
  const hand: Card[] = [];
  if (deck.length >= 2) {
    hand.push(draw(deck), draw(deck));
  }
  return { ...state, deck, hand, redrawsRemaining: state.redrawsRemaining - 1, handResult: null, log: [...state.log, "Hand redrawn."] };
}

export function startNextRound(state: RunState): RunState {
  const round = state.round + 1;
  return {
    ...state,
    round,
    target: targetForRound(round),
    roundScore: 0,
    handsRemaining: handsForRun(state),
    redrawsRemaining: redrawsForRun(state),
    hand: [],
    playing: false,
    handResult: null,
    phase: "playing",
    log: [...state.log, `Round ${round} begins. Target: ${targetForRound(round)}.`],
  };
}

export function buyJoker(state: RunState, id: JokerId): RunState {
  const def = getJoker(id);
  if (state.coins < def.cost) return state;
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

export function reshuffleIfNeeded(state: RunState): RunState {
  if (state.deck.length >= 2) return state;
  return { ...state, deck: shuffle(buildStandardDeck()) };
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
  return { ...meta, discoveredJokers };
}

export function rankDisplay(rank: Rank): string {
  return rank;
}

export function cardColor(card: Card): string {
  return card.suit === "♥" || card.suit === "♦" ? "#ff5d8f" : "#eaf6ff";
}
