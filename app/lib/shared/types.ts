import { BoxTier, RoleLevelValue } from "./constants";

export type UserId = string;
export type SessionId = string;

export type AuthMethod = "discord_embedded" | "discord_oauth" | "mobile_pair" | "username";

export interface User {
  id: UserId;
  username: string;
  role: number;
  createdAt: number;
  lastSeen: number;
  banned?: boolean;
  fingerprintLocked?: string | null;
  fingerprintLockedAt?: number | null;
  customizations?: UserCustomizations;
}

export interface UserCustomizations {
  nameColor?: string | null;
  skin?: "glass" | "cartoon" | null;
  layoutMode?: "auto" | "discord" | "standalone" | null;
  scale?: number | null;
  hideTutorial?: boolean;
  emoteSet?: string[];
}

export interface Session {
  id: SessionId;
  userId: UserId;
  token: string;
  createdAt: number;
  lastActivity: number;
  method: AuthMethod;
  fingerprint?: string | null;
  expiresAt: number;
}

export interface Wallet {
  userId: UserId;
  balance: number;
  reserved: number;
  lastRefillAt: number;
  lastLargeRefillAt: number;
  lifetimeWon: number;
  lifetimeWagered: number;
  biggestWin: number;
}

export type BetOutcome = "win" | "loss" | "push";

export interface BetRecord {
  id: string;
  userId: UserId;
  game: string;
  tableId?: string | null;
  amount: number;
  payout: number;
  outcome: BetOutcome;
  commit: string;
  reveal: string;
  createdAt: number;
}

export interface WalletDelta {
  amount: number;
  reason: string;
  tableId?: string | null;
  gameId?: string | null;
}

export interface CommitReveal {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string | null;
  nonce: number;
}

// NOTE: The blackjack engine encodes cards as integer indices (legacy contract).
// Indices < 1000 are standard cards (i % 13 => rank, floor(i/13) % 4 => suit).
// Indices >= 1000 are "magic" cards encoded as 1000 + suitIdx*20 + rankCode.
// See app/lib/server/blackjack/cards.ts for encode/decode helpers.
export type CardIndex = number;

export type BlackjackPhase =
  | "betting"
  | "player_turns"
  | "dealer"
  | "dealer_window"
  | "settling";

export type HandAction = "hit" | "stand" | "double_down" | "split";

export type CardRarity = "common" | "rare" | "legendary" | "mythic";

export type SpecialTiming = "betting" | "own_turn" | "dealer_window" | "anytime";
export type SpecialTarget = "self" | "dealer" | "any";
export type SpecialRarity = "common" | "rare" | "legendary" | "mythic";

// Powerup ID union — must stay in sync with inventory.ts SPECIALS keys
export type SpecialId =
  | "ADD2_SELF"
  | "ADD1_SELF"
  | "PEEK_NEXT"
  | "BJ_PROTECTOR"
  | "FREE_SPLIT"
  | "SWAP_ONE"
  | "DOUBLE_PAYOUT"
  | "REMOVE_CARD_SELF"
  | "REMOVE_RANDOM_SELF"
  | "ADD2_DEALER"
  | "DEALER_SECOND_CHANCE"
  | "ADD2_TARGET"
  | "FORCE_HIT_TARGET"
  | "ADD1_MAGIC"
  | "ADD2_MAGIC"
  | "SUB1_SELF"
  | "SUB2_SELF"
  | "SUB5_SELF"
  | "SUB10_SELF"
  | "MAGIC_ACE"
  | "MAGIC_KING"
  | "MAGIC_QUEEN"
  | "MAGIC_JACK"
  | "MAGIC_JOKER"
  | "MYTHIC_COPY_HANDS";

export interface SpecialDef {
  id: SpecialId;
  name: string;
  shortName?: string;
  desc: string;
  rarity: SpecialRarity;
  timing: SpecialTiming;
  target: SpecialTarget;
}

export interface SeatEffect {
  id: string;
  at: number;
  fromUserId: string;
  fromUsername: string;
  powerupId: string;
  powerupName: string;
}

// A single hand within a seat. A seat may hold up to 4 hands (3 splits).
export interface BlackjackHand {
  bet: number;
  nonces: number[];
  perfectPairsWager: number;
  perfectPairsNonce: number | null;
  perfectPairsSettled: boolean;
  cards: CardIndex[];
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  doublePayoutArmed: boolean;
  usedThisRound: Record<string, boolean>;
  effects: SeatEffect[];
}

export interface PlayerSeat {
  userId: string;
  username: string;
  prestigeLevel?: number;
  nameColor?: string | null;
  avatarUrl?: string | null;
  allIn?: boolean;
  joinedAt: number;
  lastSeenAt: number;
  missedRounds: number;
  skipThisRound: boolean;
  inventory: BlackjackInventory;
  // Legacy single-hand mirror (derived from hands[activeHandIndex] by normalize)
  bet: number;
  betNonce?: number | null;
  cards: CardIndex[];
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  doublePayoutArmed: boolean;
  usedThisRound: Record<string, boolean>;
  hands: BlackjackHand[];
  activeHandIndex: number;
  lastBetPlaced: number;
  carryBetNext: number;
  lastBox?: string[];
  bjProtected: boolean;
  extendUsedThisTurn: boolean;
}

export interface BlackjackDealer {
  cards: CardIndex[];
  bonusPoints: number;
  secondChanceArmed: boolean;
  secondChanceUsed: boolean;
  effects: SeatEffect[];
}

export interface SettlementEntry {
  nonce: number;
  wager: number;
  multiplier: number;
  outcome: string;
}

export interface PlayerRoundResult {
  outcome: string;
  multiplier: number;
  wager: number;
  settlements: SettlementEntry[];
  ppSettlements?: SettlementEntry[];
}

export interface BlackjackTable {
  id: string;
  public: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  turnDurationMs?: number;
  disabledCategories?: string[];
  passwordEnabled?: boolean;
  password?: string | null;
  afkKickEnabled?: boolean;
  chat: ChatLine[];
  events: TableEvent[];
  decorations: TableDecoration[];
  phase: BlackjackPhase;
  round: number;
  bettingEndsAt: number;
  turnEndsAt: number;
  dealerWindowEndsAt: number;
  seats: (PlayerSeat | null)[];
  spectators: string[];
  participants: number[];
  turnIndex: number;
  shoe: CardIndex[];
  shoeInitialSize?: number;
  shoeCardsDealt?: number;
  shoeCutCardAt?: number;
  shoeShufflePending?: boolean;
  dealer: BlackjackDealer;
  dealerBlackjack: boolean;
  peekByUserId: Record<string, number | null>;
  evictedInventories: { userId: string; inventory: BlackjackInventory }[];
  lastResults: Record<string, PlayerRoundResult>;
}

export interface ChatLine {
  id: string;
  userId: string;
  username: string;
  text: string;
  at: number;
  prestigeLevel?: number;
  nameColor?: string | null;
}

export interface TableEvent {
  id: string;
  at: number;
  text: string;
}

export interface TableDecoration {
  id: string;
  ownerUserId: string;
  kind: "emoji" | "figurine";
  key?: string;
  imageUrl?: string;
  x: number;
  y: number;
  createdAt: number;
}

export type InventoryCategoryId =
  | "boosts"
  | "saves"
  | "utility"
  | "magic"
  | "dealer"
  | "mythic";

export interface InventoryBox {
  id: string;
  tier: BoxTier;
  awardedAt: number;
  openedAt?: number;
  opened: boolean;
  contents?: string[];
  source?: string;
}

export interface InventoryBond {
  owned: number;
  active: {
    principal: number;
    value: number;
    startedAt: number;
    lastAccrualAt: number;
  } | null;
}

// Unified decoration type used both for placed collectibles in inventory
// and for table decorations. All fields must be present for both uses.
export interface PlacedCollectible {
  id: string;
  ownerUserId: string;
  kind: "emoji" | "figurine";
  key?: string;
  imageUrl?: string;
  x: number;
  y: number;
  placedAt?: number;
  createdAt: number;
}

export interface InventoryCollectibles {
  owned: Record<string, number>;
  figurines: { id: string; imageUrl: string; createdAt: number }[];
  placed: PlacedCollectible[];
}

export interface BlackjackInventory {
  v: 3;
  handsPlayed: number;
  bonusPoints: number;
  allInWinStreak: number;
  categories: Record<InventoryCategoryId, Record<string, number>>;
  boxes: InventoryBox[];
  bond: InventoryBond;
  collectibles: InventoryCollectibles;
}

// D3 enrichment: optional powerup transaction log (capped, persisted for debugging)
export interface PowerupLedgerEntry {
  id: string;
  powerupId: string;
  delta: number;
  source: string;
  destination: string | null;
  tableId: string | null;
  createdAt: number;
}

export interface Collectible {
  key: string;
  name: string;
  source: string;
}

export interface LeaderboardEntry {
  userId: UserId;
  username: string;
  role: number;
  netWon: number;
  biggestWin: number;
  prestigeLevel: number;
}

export interface PrestigeState {
  level: number;
  points: number;
  pointsThisLevel: number;
  pointsForNextLevel: number;
  unspentCredits: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  pinned: boolean;
  authorId: string;
}

export interface ChatMessage {
  id: string;
  userId: UserId;
  username: string;
  scope: "global" | string;
  body: string;
  createdAt: number;
}

export type Emote = {
  id: string;
  label: string;
  emoji: string;
};

export interface AppEvent<T = unknown> {
  type: string;
  payload: T;
  createdAt: number;
}
