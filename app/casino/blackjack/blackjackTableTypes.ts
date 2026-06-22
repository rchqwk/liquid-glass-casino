export type Seat = {
  userId: number;
  username: string;
  prestigeLevel?: number;
  nameColor?: string | null;
  avatarUrl?: string | null;
  missedRounds: number;
  bet: number;
  cards: number[];
  activeHandIndex?: number;
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  extendUsedThisTurn?: boolean;
  inventory?: Record<string, number>;
  usedThisRound?: Record<string, boolean>;
  doublePayoutArmed?: boolean;
  bjProtected?: boolean;
  allIn?: boolean;
  allInWinStreak?: number;
  hands?: Array<{
    cards: number[];
    bonusPoints?: number;
    effects?: Array<{ id: string; at: number; fromUsername: string; powerupName: string }>;
  }>;
};

export type BJState = {
  id: string;
  name: string;
  public: boolean;
  phase: string;
  round: number;
  bettingEndsAt: number;
  turnEndsAt: number;
  dealerWindowEndsAt: number;
  turnDurationMs?: number;
  disabledCategories?: string[];
  passwordEnabled?: boolean;
  afkKickEnabled?: boolean;
  chat?: Array<{ id: string; userId: number; username: string; text: string; at: number; prestigeLevel?: number; nameColor?: string | null }>;
  events?: Array<{ id: string; at: number; text: string }>;
  seats: Array<Seat | null>;
  spectators: number[];
  participants: number[];
  turnIndex: number;
  dealer: { cards: number[]; bonusPoints: number; effects?: Array<{ id: string; at: number; fromUsername: string; powerupName: string }> };
  peekCard?: number | null;
  meSeatIndex?: number;
  meInventory?: any;
  lastResult?: {
    outcome: string;
    multiplier: number;
    wager?: number;
    settlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
    ppSettlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
  } | null;
  decorations?: Array<{
    id: string;
    ownerUserId: number;
    kind: "emoji" | "figurine";
    key?: string;
    imageUrl?: string;
    x: number;
    y: number;
    createdAt: number;
  }>;
};
