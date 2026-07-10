export const RoleLevel = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  MASTER: 3,
} as const;

export type RoleLevelValue = (typeof RoleLevel)[keyof typeof RoleLevel];

export const ROLE_LABELS: Record<number, string> = {
  0: "Player",
  1: "Moderator",
  2: "Admin",
  3: "Master",
};

export function canViewAdmin(role: number): boolean {
  return role >= RoleLevel.MODERATOR;
}

export function canApproveReset(role: number): boolean {
  return role >= RoleLevel.MODERATOR;
}

export function canWipeUsers(role: number): boolean {
  return role >= RoleLevel.ADMIN;
}

export function canResetLeaderboard(role: number): boolean {
  return role >= RoleLevel.ADMIN;
}

export function canManageRoles(role: number): boolean {
  return role >= RoleLevel.MASTER;
}

export function canEditConfig(role: number): boolean {
  return role >= RoleLevel.MASTER;
}

export const SESSION = {
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,
  FINGERPRINT_LOCK_MS: 24 * 60 * 60 * 1000,
  INACTIVE_PURGE_DAYS: 30,
  TOKEN_COOKIE: "lgc_session",
  TOKEN_HEADER: "x-lgc-session",
} as const;

export const WALLET = {
  STARTING_BALANCE: 1000,
  QUICK_REFILL: 500,
  LARGE_REFILL: 5000,
  REFILL_COOLDOWN_MS: 3 * 60 * 60 * 1000,
  LARGE_REFILL_COOLDOWN_MS: 24 * 60 * 60 * 1000,
  BIG_WIN_MULTIPLE: 10,
} as const;

export const BLACKJACK = {
  SEATS: 10,
  MAX_HANDS_PER_SEAT: 4,
  TURN_TIME_MS: 30 * 1000,
  LONG_TURN_TIME_MS: 60 * 1000,
  EXTENSION_TIME_MS: 15 * 1000,
  BETTING_PHASE_MS: 30 * 1000,
  DEALER_WINDOW_MS: 10 * 1000,
  SETTLING_MS: 4 * 1000,
  DEALER_HIT_BELOW: 17,
  AFK_KICK_MISSED_ROUNDS: 5,
  BLACKJACK_PAYOUT_MULT: 3,
  TRIPLE_SEVEN_PAYOUT_MULT: 8,
  DEALER_BUST_PAYOUT_MULT: 2,
  NORMAL_WIN_PAYOUT_MULT: 2,
  FIVE_CARD_BONUS_PER_CARD: 2,
  PERFECT_PAIRS_SAME_SUIT: 26,
  PERFECT_PAIRS_SAME_COLOR: 13,
  PERFECT_PAIRS_SAME_RANK: 7,
  SHOE_DECKS: 4,
  SHOE_JOKERS: 8,
  RESHUFFLE_THRESHOLD: 0.25,
  CHAT_MAX_LENGTH: 240,
  CHAT_HISTORY_CAP: 120,
  EVENT_HISTORY_CAP: 80,
  EFFECT_HISTORY_CAP: 10,
  NORMAL_BOX_EVERY_HANDS: 3,
} as const;

export const BOX_TIER = {
  NORMAL: "normal",
  RARE: "rare",
  LEGENDARY: "legendary",
  MYTHIC: "mythic",
} as const;

export type BoxTier = (typeof BOX_TIER)[keyof typeof BOX_TIER];

export const BOX_TIER_ORDER: BoxTier[] = ["normal", "rare", "legendary", "mythic"];

export const BOX_DROP_RATES: Record<BoxTier, { rarity: string; weight: number }[]> = {
  normal: [
    { rarity: "common", weight: 70 },
    { rarity: "rare", weight: 25 },
    { rarity: "legendary", weight: 5 },
  ],
  rare: [
    { rarity: "rare", weight: 80 },
    { rarity: "legendary", weight: 20 },
  ],
  legendary: [{ rarity: "legendary", weight: 100 }],
  mythic: [{ rarity: "mythic", weight: 100 }],
};

export const BOX_TRADE_UP_COST = 3;

export const HANDS_PER_BOX_DROP = 3;

export const POWERUP_LEDGER_CAP = 100;
export const EFFECT_HISTORY_CAP = 10;
export const EMOTE_LIFETIME_MS = 2000;

export const COLLECTIBLE_SOURCES = {
  BLACKJACK: "blackjack",
  TRIPLE_SEVEN: "triple_seven",
  SEVEN_CARD_WIN: "seven_card_win",
} as const;

export const LEADERBOARD_LIMIT = 50;

export const INVENTORY_SCHEMA_VERSION = 3;
