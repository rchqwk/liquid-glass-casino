"server-only";

export type Suit = "♠" | "♥" | "♦" | "♣" | "★";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "JOKER";

export type Card = { rank: Rank; suit: Suit; value: number }; // value for non-ace

export type Phase =
  | "betting"
  | "player_turns"
  | "dealer"
  | "dealer_window" // dealer has stood; short window for dealer-phase specials
  | "settling";

export type SpecialId =
  | "ADD2_SELF"
  | "ADD1_SELF"
  | "PEEK_NEXT"
  | "BJ_PROTECTOR"
  | "FREE_SPLIT"
  | "SWAP_ONE"
  | "DOUBLE_PAYOUT"
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

export type SpecialRarity = "common" | "rare" | "legendary" | "mythic";
export type SpecialTiming = "betting" | "own_turn" | "dealer_window" | "anytime";

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
  ADD1_SELF: {
    id: "ADD1_SELF",
    name: "+1 (You)",
    desc: "Add +1 to your hand total. Only usable on your turn.",
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
  BJ_PROTECTOR: {
    id: "BJ_PROTECTOR",
    name: "BJ Protector",
    desc: "Protect yourself from dealer blackjack this round (push instead of lose). Only usable during betting phase.",
    rarity: "rare",
    timing: "betting",
    target: "self",
  },
  FREE_SPLIT: {
    id: "FREE_SPLIT",
    name: "Free Split",
    desc: "Legendary: allows you to split ANY starting 2 cards (even if ranks don't match). Consumed when you split.",
    rarity: "legendary",
    timing: "anytime",
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
  ADD1_MAGIC: {
    id: "ADD1_MAGIC",
    name: "+1 Magic",
    desc: "Add +1 to anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  ADD2_MAGIC: {
    id: "ADD2_MAGIC",
    name: "+2 Magic",
    desc: "Add +2 to anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  SUB1_SELF: {
    id: "SUB1_SELF",
    name: "-1 (Save)",
    desc: "Subtract 1 from your total. Can save you from bust as long as your turn is not over.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  SUB2_SELF: {
    id: "SUB2_SELF",
    name: "-2 (Save)",
    desc: "Subtract 2 from your total. Can save you from bust as long as your turn is not over.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  SUB5_SELF: {
    id: "SUB5_SELF",
    name: "-5 (Save)",
    desc: "Subtract 5 from your total. Rare. Can save you from bust as long as your turn is not over.",
    rarity: "rare",
    timing: "own_turn",
    target: "self",
  },
  SUB10_SELF: {
    id: "SUB10_SELF",
    name: "-10 (Save)",
    desc: "Subtract 10 from your total. Very rare. Can save you from bust as long as your turn is not over.",
    rarity: "legendary",
    timing: "own_turn",
    target: "self",
  },
  // Magic "rank" cards (summon a card into a hand)
  MAGIC_ACE: {
    id: "MAGIC_ACE",
    name: "Magic Ace",
    desc: "Summon an Ace into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_KING: {
    id: "MAGIC_KING",
    name: "Magic King",
    desc: "Summon a King into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_QUEEN: {
    id: "MAGIC_QUEEN",
    name: "Magic Queen",
    desc: "Summon a Queen into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_JACK: {
    id: "MAGIC_JACK",
    name: "Magic Jack",
    desc: "Summon a Jack into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_JOKER: {
    id: "MAGIC_JOKER",
    name: "Magic Joker",
    desc: "Summon a Joker into anybody’s hand (including dealer). Legendary magic. Joker counts as 0. Usable any time before end of round.",
    rarity: "legendary",
    timing: "anytime",
    target: "any",
  },
  MYTHIC_COPY_HANDS: {
    id: "MYTHIC_COPY_HANDS",
    name: "Mythic: Copy Hands",
    desc: "MYTHIC: Copy a chosen player's current hand to EVERYONE (except dealer). Usable any time before end of round.",
    rarity: "mythic",
    timing: "anytime",
    target: "any",
  },
};

export type InventoryCategoryId = "boosts" | "saves" | "utility" | "magic" | "dealer" | "mythic";

export type Inventory = {
  v: 2;
  // How many hands this player has participated in at this table/session (persisted)
  handsPlayed: number;
  categories: Record<InventoryCategoryId, Partial<Record<SpecialId, number>>>;
  boxes: Array<{
    id: string;
    tier: "normal" | "rare" | "legendary" | "mythic";
    awardedAt: number;
    openedAt?: number;
    opened: boolean;
    contents?: SpecialId[]; // stored server-side; omitted from GET response for unopened boxes
  }>;
};

function classifySpecial(id: SpecialId): InventoryCategoryId {
  if (SPECIALS[id]?.rarity === "mythic") return "mythic";
  if (id.startsWith("MAGIC_") || id.includes("_MAGIC")) return "magic";
  if (id.startsWith("SUB")) return "saves";
  if (id.includes("DEALER")) return "dealer";
  if (
    id === "PEEK_NEXT" ||
    id === "SWAP_ONE" ||
    id === "FORCE_HIT_TARGET" ||
    id === "BJ_PROTECTOR" ||
    id === "FREE_SPLIT"
  )
    return "utility";
  return "boosts";
}

function normalizeInventory(raw: any): Inventory {
  // Migration from the old flat object: {SPECIAL_ID: count}
  if (raw && raw.v === 2 && raw.categories) {
    const cats = raw.categories ?? {};
    return {
      v: 2,
      handsPlayed: Number(raw.handsPlayed ?? 0) || 0,
      categories: {
        boosts: (cats.boosts ?? {}) as any,
        saves: (cats.saves ?? {}) as any,
        utility: (cats.utility ?? {}) as any,
        magic: (cats.magic ?? {}) as any,
        dealer: (cats.dealer ?? {}) as any,
        mythic: (cats.mythic ?? {}) as any,
      },
      boxes: Array.isArray(raw.boxes)
        ? (raw.boxes as any[]).map((b) => ({
            id: String(b?.id ?? ""),
            tier: (b?.tier === "rare" || b?.tier === "legendary" || b?.tier === "mythic" ? b.tier : "normal") as any,
            awardedAt: Number(b?.awardedAt ?? 0) || 0,
            openedAt: b?.openedAt != null ? Number(b.openedAt) : undefined,
            opened: !!b?.opened,
            contents: Array.isArray(b?.contents) ? (b.contents as SpecialId[]) : undefined,
          }))
        : [],
    };
  }

  const inv: Inventory = {
    v: 2,
    handsPlayed: 0,
    categories: { boosts: {}, saves: {}, utility: {}, magic: {}, dealer: {}, mythic: {} },
    boxes: [],
  };

  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const id = k as SpecialId;
      if (!(id in SPECIALS)) continue;
      const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < 0) continue;
      const cat = classifySpecial(id);
      inv.categories[cat][id] = (inv.categories[cat][id] ?? 0) + n;
    }
  }
  return inv;
}

export function ensureInventory(raw: any): Inventory {
  return normalizeInventory(raw);
}

export function unopenedBoxCount(inv: Inventory) {
  return (inv.boxes ?? []).filter((b) => !b.opened).length;
}

function invGet(inv: Inventory, id: SpecialId) {
  const cat = classifySpecial(id);
  return Number(inv.categories?.[cat]?.[id] ?? 0);
}

function invAdd(inv: Inventory, id: SpecialId, amount: number) {
  const cat = classifySpecial(id);
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return;
  inv.categories[cat][id] = Math.max(0, (inv.categories[cat][id] ?? 0) + n);
}

function invConsume(inv: Inventory, id: SpecialId) {
  if (invGet(inv, id) <= 0) return false;
  invAdd(inv, id, -1);
  return true;
}

function rarityOf(id: SpecialId): SpecialRarity {
  return (SPECIALS[id]?.rarity ?? "common") as SpecialRarity;
}

function ranksEqualForSplit(cardA: number, cardB: number) {
  try {
    return cardFromIndex(cardA).rank === cardFromIndex(cardB).rank;
  } catch {
    return false;
  }
}

function perfectPairsMultiplier(cardA: number, cardB: number): number {
  // 25 / 12 / 6 (perfect / colored / mixed)
  try {
    const a = cardFromIndex(cardA);
    const b = cardFromIndex(cardB);
    if (a.rank !== b.rank) return 0;
    const aRed = a.suit === "♥" || a.suit === "♦";
    const bRed = b.suit === "♥" || b.suit === "♦";
    if (a.suit === b.suit) return 26; // 25:1 profit -> return multiplier 26x
    if (aRed === bRed) return 13; // 12:1 profit -> 13x return
    return 7; // 6:1 profit -> 7x return
  } catch {
    return 0;
  }
}

function normalizeHandsForSeat(p: any) {
  if (!p) return;
  if (typeof p.lastBetPlaced !== "number" || !Number.isFinite(p.lastBetPlaced)) p.lastBetPlaced = 0;
  if (typeof p.carryBetNext !== "number" || !Number.isFinite(p.carryBetNext)) p.carryBetNext = 0;
  if (!Array.isArray(p.hands) || p.hands.length === 0) {
    p.hands = [
      {
        bet: Number(p.bet ?? 0) || 0,
        nonces: Array.isArray(p.nonces) ? p.nonces : [],
        perfectPairsWager: 0,
        perfectPairsNonce: null,
        perfectPairsSettled: false,
        cards: Array.isArray(p.cards) ? p.cards : [],
        bonusPoints: Number(p.bonusPoints ?? 0) || 0,
        stood: !!p.stood,
        busted: !!p.busted,
        turnEnded: !!p.turnEnded,
        doublePayoutArmed: !!p.doublePayoutArmed,
        usedThisRound: (p.usedThisRound ?? {}) as any,
      },
    ];
    p.activeHandIndex = 0;
  }
  if (typeof p.activeHandIndex !== "number" || !Number.isFinite(p.activeHandIndex)) p.activeHandIndex = 0;
  if (p.activeHandIndex < 0) p.activeHandIndex = 0;
  if (p.activeHandIndex >= p.hands.length) p.activeHandIndex = p.hands.length - 1;

  // Ensure each hand has defaults
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
    h.usedThisRound = (h.usedThisRound ?? {}) as any;
  }

  // Sync legacy fields from active hand (for UI compatibility)
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

export type PlayerSeat = {
  userId: number;
  username: string;
  joinedAt: number;
  lastSeenAt: number;
  missedRounds: number;
  skipThisRound: boolean;
  inventory: Inventory;

  // round state
  // Legacy single-hand fields are kept for backward compatibility, but are derived
  // from the currently active hand (hands[activeHandIndex]).
  bet: number;
  betNonce?: number | null; // client-side only; kept for convenience
  cards: number[];
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  doublePayoutArmed: boolean;
  usedThisRound: Partial<Record<SpecialId, boolean>>;

  // Multi-hand (split) support
  hands: Array<{
    bet: number;
    nonces: number[]; // wallet nonces for stakes backing this hand (split/DD create additional nonces)
    perfectPairsWager: number;
    perfectPairsNonce: number | null;
    perfectPairsSettled: boolean;
    cards: number[];
    bonusPoints: number;
    stood: boolean;
    busted: boolean;
    turnEnded: boolean;
    doublePayoutArmed: boolean;
    usedThisRound: Partial<Record<SpecialId, boolean>>;
  }>;
  activeHandIndex: number;

  // Betting carryover
  lastBetPlaced: number;
  carryBetNext: number;

  lastBox?: SpecialId[];
  bjProtected: boolean;
  extendUsedThisTurn: boolean;
};

export type TableState = {
  id: string;
  public: boolean;
  name: string;
  createdAt: number;
  updatedAt: number;
  // Updated only on player activity (join/leave/bet/actions), NOT on passive polling ticks.
  lastActivityAt: number;

  // Table settings (host-controlled)
  turnDurationMs?: number; // 30000 (default) or 60000
  disabledCategories?: InventoryCategoryId[]; // disables use of specials in these categories
  passwordEnabled?: boolean;
  password?: string | null; // never sent to clients
  afkKickEnabled?: boolean; // default true

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
  dealerBlackjack: boolean;
  peekByUserId: Record<string, number | null>; // userId -> cardIndex or null
  evictedInventories: Array<{ userId: number; inventory: Inventory }>;

  lastResults?: Record<
    string,
    {
      outcome: string;
      multiplier: number;
      wager: number;
      settlements: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
      ppSettlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
    }
  >;
};

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const MAGIC_CARD_BASE = 1000;
type MagicRank = "A" | "K" | "Q" | "J" | "JOKER";
function magicRankCode(r: MagicRank) {
  if (r === "JOKER") return 0;
  if (r === "A") return 1;
  if (r === "J") return 11;
  if (r === "Q") return 12;
  return 13; // K
}
function encodeMagicCard(rank: MagicRank, suitIdx: number) {
  return MAGIC_CARD_BASE + suitIdx * 20 + magicRankCode(rank);
}

export function cardFromIndex(i: number): Card {
  if (i >= MAGIC_CARD_BASE) {
    const t = i - MAGIC_CARD_BASE;
    const suitIdx = Math.floor(t / 20);
    const code = t % 20;
    if (code === 0) return { rank: "JOKER", suit: "★", value: 0 };
    const suit = (["♠", "♥", "♦", "♣"] as const)[Math.max(0, Math.min(3, suitIdx))]!;
    const rank = (code === 1 ? "A" : code === 11 ? "J" : code === 12 ? "Q" : "K") as Rank;
    const value = rank === "A" ? 1 : 10;
    return { rank, suit, value };
  }
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
  const inv: Inventory = {
    v: 2,
    handsPlayed: 0,
    categories: { boosts: {}, saves: {}, utility: {}, magic: {}, dealer: {}, mythic: {} },
    boxes: [],
  };
  // Small starter kit
  invAdd(inv, "ADD2_SELF", 1);
  invAdd(inv, "ADD1_SELF", 1);
  invAdd(inv, "PEEK_NEXT", 1);
  invAdd(inv, "DOUBLE_PAYOUT", 1);
  invAdd(inv, "SUB1_SELF", 1);
  invAdd(inv, "BJ_PROTECTOR", 1);
  return inv;
}

function randSpecial(seed: number, rarity: SpecialRarity): SpecialId {
  const pool = Object.values(SPECIALS).filter((s) => s.rarity === rarity).map((s) => s.id);
  const r = lcg(seed)();
  return pool[Math.floor(r * pool.length)] ?? "ADD2_SELF";
}

function rollBox(tier: "normal" | "rare" | "legendary" | "mythic", seed: number): SpecialId[] {
  const rand = lcg(seed);

  const weightedPick = (pool: Array<{ id: SpecialId; w: number }>, exclude: Set<SpecialId>) => {
    let total = 0;
    for (const p of pool) total += exclude.has(p.id) ? 0 : p.w;
    let r = rand() * total;
    for (const p of pool) {
      if (exclude.has(p.id)) continue;
      r -= p.w;
      if (r <= 0) return p.id;
    }
    return pool[0]?.id ?? "ADD2_SELF";
  };

  if (tier === "mythic") {
    const pool = Object.values(SPECIALS)
      .filter((s) => s.rarity === "mythic")
      .map((s) => ({ id: s.id, w: 1 }));
    return [weightedPick(pool, new Set())];
  }

  if (tier === "legendary") {
    const pool = Object.values(SPECIALS)
      .filter((s) => s.rarity === "legendary")
      .map((s) => ({ id: s.id, w: 1 }));
    return [weightedPick(pool, new Set())];
  }

  if (tier === "rare") {
    const weights: Record<SpecialRarity, number> = { common: 0, rare: 80, legendary: 20, mythic: 0 };
    const pool = Object.values(SPECIALS)
      .filter((s) => s.rarity === "rare" || s.rarity === "legendary")
      .map((s) => ({ id: s.id, w: weights[s.rarity] ?? 1 }));
    const used = new Set<SpecialId>();
    const a = weightedPick(pool, used);
    used.add(a);
    const b = weightedPick(pool, used);
    return [a, b];
  }

  // normal
  const weights: Record<SpecialRarity, number> = { common: 70, rare: 25, legendary: 5, mythic: 0 };
  const pool = Object.values(SPECIALS)
    .filter((s) => s.rarity !== "mythic")
    .map((s) => ({ id: s.id, w: weights[s.rarity] ?? 1 }));
  const out: SpecialId[] = [];
  const used = new Set<SpecialId>();
  for (let i = 0; i < 3; i++) {
    const id = weightedPick(pool, used);
    out.push(id);
    used.add(id);
  }
  return out;
}

function shortId() {
  return Math.random().toString(16).slice(2, 10);
}

export function newTableState(input: { id: string; name: string; public: boolean; now: number }): TableState {
  return {
    id: input.id,
    public: input.public,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    lastActivityAt: input.now,
    turnDurationMs: 30_000,
    disabledCategories: [],
    passwordEnabled: false,
    password: null,
    afkKickEnabled: true,
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
    dealerBlackjack: false,
    peekByUserId: {},
    evictedInventories: [],
    lastResults: {},
  };
}

export function tickTable(state: TableState, now: number): TableState {
  // IMPORTANT: updatedAt should only change when the table state actually changes.
  // If updatedAt changes on every poll, it causes constant DB writes and can overwrite
  // other sources-of-truth (like inventory updates from the mystery box endpoint).
  const s: TableState = { ...state };

  // Default settings
  if (typeof s.turnDurationMs !== "number" || !Number.isFinite(s.turnDurationMs)) s.turnDurationMs = 30_000;
  if (!Array.isArray(s.disabledCategories)) s.disabledCategories = [];
  s.passwordEnabled = !!s.passwordEnabled;
  if (s.passwordEnabled && typeof s.password !== "string") s.password = String(s.password ?? "");
  if (!s.passwordEnabled) s.password = null;
  if (typeof s.afkKickEnabled !== "boolean") s.afkKickEnabled = true;

  // Inventory migration safety
  for (const p of s.seats) {
    if (!p) continue;
    p.inventory = normalizeInventory(p.inventory);
    normalizeHandsForSeat(p);
  }

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
      s.updatedAt = now;
      return s;
    }
    // Dealer stands -> open window for dealer specials
    s.phase = "dealer_window";
    s.dealerWindowEndsAt = now + 8_000;
    s.updatedAt = now;
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
  s.dealerBlackjack = false;
  s.peekByUserId = {};
  s.lastResults = s.lastResults ?? {};
  s.evictedInventories = s.evictedInventories ?? [];

  // Reset round-specific flags, keep inventory
  for (let i = 0; i < s.seats.length; i++) {
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

  // Drop players who missed 5 rounds (AFK kick)
  if (s.afkKickEnabled) {
    for (let i = 0; i < s.seats.length; i++) {
      const p = s.seats[i];
      if (!p) continue;
      if (p.missedRounds >= 5) {
        s.evictedInventories = s.evictedInventories ?? [];
        s.evictedInventories.push({ userId: p.userId, inventory: p.inventory });
        s.seats[i] = null;
      }
    }
  }

  if (participants.length === 0) {
    // no one bet; restart betting
    return startBetting(s, now);
  }

  s.participants = participants;
  s.turnIndex = 0;
  s.phase = "player_turns";
  s.turnEndsAt = now + turnDurationMs(s);
  s.peekByUserId = {};
  s.dealerBlackjack = false;

  // new shoe each round (MVP)
  const seed = Math.floor(now / 1000) ^ (s.round * 2654435761);
  s.shoe = shuffleDeck(seed);
  s.dealer = { cards: [], bonusPoints: 0, secondChanceArmed: false, secondChanceUsed: false };

  // deal: each participant 2, dealer 2
  for (const idx of participants) {
    const p = s.seats[idx]!;
    const bet = Number(p.hands?.[0]?.bet ?? p.bet ?? 0) || 0;
    const prevNonces = Array.isArray(p.hands?.[0]?.nonces) ? (p.hands[0]!.nonces as number[]) : [];
    p.hands = [
      {
        bet,
        nonces: [...prevNonces],
        perfectPairsWager: Number(p.hands?.[0]?.perfectPairsWager ?? 0) || 0,
        perfectPairsNonce: p.hands?.[0]?.perfectPairsNonce ?? null,
        perfectPairsSettled: false,
        cards: [],
        bonusPoints: 0,
        stood: false,
        busted: false,
        turnEnded: false,
        doublePayoutArmed: false,
        usedThisRound: {},
      },
    ];
    p.activeHandIndex = 0;
    // Keep bjProtected if set during betting; otherwise false.
    p.bjProtected = !!p.bjProtected;
    p.extendUsedThisTurn = false;
    const a = drawFromShoe(s);
    const b = drawFromShoe(s);
    if (a != null) p.hands[0]!.cards.push(a);
    if (b != null) p.hands[0]!.cards.push(b);
    normalizeHandsForSeat(p);
  }
  const d1 = drawFromShoe(s);
  const d2 = drawFromShoe(s);
  if (d1 != null) s.dealer.cards.push(d1);
  if (d2 != null) s.dealer.cards.push(d2);

  // If dealer has blackjack, reveal immediately and settle the hand.
  const dBJ = handTotal(s.dealer.cards, s.dealer.bonusPoints).total === 21 && s.dealer.cards.length === 2;
  if (dBJ) {
    s.dealerBlackjack = true;
    return settleRound(s, now);
  }

  // auto-finish players with blackjack
  for (const idx of participants) {
    const p = s.seats[idx]!;
    const h = p.hands?.[0];
    if (h && handTotal(h.cards, h.bonusPoints).total === 21) {
      h.turnEnded = true;
      h.stood = true;
      normalizeHandsForSeat(p);
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

function turnDurationMs(s: TableState) {
  // Only allow 30s or 60s (host setting).
  const v = Number(s.turnDurationMs ?? 30_000);
  return v === 60_000 ? 60_000 : 30_000;
}

function advanceTurn(state: TableState, now: number): TableState {
  const s: TableState = { ...state };
  // find next active hand (hands are played sequentially per seat)
  while (s.turnIndex < s.participants.length) {
    const seatIdx = s.participants[s.turnIndex]!;
    const p = s.seats[seatIdx];
    if (!p) {
      s.turnIndex += 1;
      continue;
    }
    normalizeHandsForSeat(p);
    const nextHandIdx = (p.hands ?? []).findIndex((h: any) => !h?.turnEnded);
    if (nextHandIdx < 0) {
      // seat finished all hands
      s.turnIndex += 1;
      continue;
    }
    p.activeHandIndex = nextHandIdx;
    normalizeHandsForSeat(p);
    s.turnEndsAt = now + turnDurationMs(s);
    p.extendUsedThisTurn = false;
    s.updatedAt = now;
    return s;
  }
  // all done -> dealer phase
  s.phase = "dealer";
  s.turnEndsAt = 0;
  s.updatedAt = now;
  return s;
}

export function applyBet(
  state: TableState,
  userId: number,
  amount: number,
  now: number,
  betNonce?: number | null,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "Betting is closed." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  // Only allow one bet reservation per round unless the user clears it.
  if ((p.hands?.[0]?.nonces?.length ?? 0) > 0 && (p.hands?.[0]?.bet ?? 0) > 0) {
    return { state: s, error: "Bet already placed. Clear bet before placing again." };
  }
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return { state: s, error: "Invalid bet amount." };
  p.hands[0]!.bet = Math.round(a * 100) / 100;
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
  userId: number,
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
    return { state: s, error: "Perfect Pairs bet already placed. Clear bet before placing again." };
  }
  h0.perfectPairsWager = w;
  h0.perfectPairsNonce = n;
  h0.perfectPairsSettled = false;
  normalizeHandsForSeat(p);
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
}

export function applyClearPerfectPairsBet(state: TableState, userId: number, now: number): { state: TableState; error?: string } {
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

export function applySkip(state: TableState, userId: number, now: number): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only skip during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  p.hands[0]!.bet = 0;
  p.hands[0]!.nonces = [];
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

export function applyClearBet(state: TableState, userId: number, now: number): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "betting") return { state: s, error: "You can only clear bets during betting." };
  const seatIdx = s.seats.findIndex((p) => p?.userId === userId);
  if (seatIdx < 0) return { state: s, error: "You are not seated at this table." };
  const p = s.seats[seatIdx]!;
  normalizeHandsForSeat(p);
  p.hands[0]!.bet = 0;
  p.hands[0]!.nonces = [];
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
  userId: number,
  action: { type: "hit" | "stand" | "double_down" | "split"; betNonce?: number | null },
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "Not in player turn phase." };
  const turnSeatIdx = currentTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  normalizeHandsForSeat(p);
  const h = p.hands[p.activeHandIndex]!;
  if (p.userId !== userId) return { state: s, error: "Not your turn." };
  if (action.type === "hit" && h.busted) return { state: s, error: "You are busted. Play a save card or stand." };

  if (action.type === "hit") {
    const c = drawFromShoe(s);
    if (c != null) h.cards.push(c);
    s.lastActivityAt = now;
    // Reset turn timer on irreversible action
    s.turnEndsAt = now + turnDurationMs(s);
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) {
      // Allow "save" cards (-1/-2/-5/-10) before the turn is over.
      h.busted = true;
      normalizeHandsForSeat(p);
      s.updatedAt = now;
      return { state: s };
    }
    // if 21, auto-stand
    if (t === 21) {
      h.turnEnded = true;
      h.stood = true;
      normalizeHandsForSeat(p);
      return { state: advanceTurn(s, now) };
    }
    normalizeHandsForSeat(p);
    s.updatedAt = now;
    return { state: s };
  }

  if (action.type === "double_down") {
    if (h.busted) return { state: s, error: "You are busted." };
    if (h.cards.length !== 2) return { state: s, error: "Double down is only allowed on your first two cards." };
    if (!(h.bet > 0)) return { state: s, error: "No bet placed." };
    if (action.betNonce == null) return { state: s, error: "Wallet nonce missing for double down." };
    const n = Number(action.betNonce);
    if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing for double down." };
    // Double the bet (reserve additional stake via betNonce), draw exactly one card, then stand.
    h.bet = Math.round(h.bet * 2 * 100) / 100;
    h.nonces = [...(h.nonces ?? []), n];
    const c = drawFromShoe(s);
    if (c != null) h.cards.push(c);
    s.lastActivityAt = now;
    s.turnEndsAt = now + turnDurationMs(s);
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) h.busted = true;
    h.turnEnded = true;
    h.stood = true;
    normalizeHandsForSeat(p);
    return { state: advanceTurn(s, now) };
  }

  if (action.type === "split") {
    if (h.busted) return { state: s, error: "You are busted." };
    if (h.turnEnded) return { state: s, error: "Hand already ended." };
    if (h.cards.length !== 2) return { state: s, error: "Split only allowed with exactly 2 cards." };
    if ((p.hands?.length ?? 1) >= 4) return { state: s, error: "Max splits reached (4 hands)." };

    if (action.betNonce == null) return { state: s, error: "Wallet nonce missing for split." };
    const n = Number(action.betNonce);
    if (!Number.isFinite(n) || n < 0) return { state: s, error: "Wallet nonce missing for split." };

    const ranksMatch = ranksEqualForSplit(h.cards[0]!, h.cards[1]!);
    const canFreeSplit = invGet(p.inventory, "FREE_SPLIT") > 0;
    const canSplit = ranksMatch || canFreeSplit;
    if (!canSplit) return { state: s, error: "Split requires matching ranks (or Free Split powerup)." };

    if (!ranksMatch && canFreeSplit) {
      // Only consume when used to bypass rank condition.
      invConsume(p.inventory, "FREE_SPLIT");
    }

    const c1 = h.cards[0]!;
    const c2 = h.cards[1]!;

    const newHandA = {
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
    };
    const newHandB = {
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
    };

    // Replace current hand with hand A, insert hand B after it
    const hands = p.hands ?? [];
    hands.splice(p.activeHandIndex, 1, newHandA, newHandB);
    p.hands = hands;

    // Deal one card to each split hand immediately
    const a = drawFromShoe(s);
    const b = drawFromShoe(s);
    if (a != null) newHandA.cards.push(a);
    if (b != null) newHandB.cards.push(b);

    // If splitting aces: allow resplit aces up to 4 per your rule, but otherwise play normally.
    // (No special restriction.)

    // If hand A hits 21, auto-stand it.
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

    // Continue with current seat; choose the first non-ended hand as active
    p.activeHandIndex = Math.max(0, p.hands.findIndex((hh: any) => !hh?.turnEnded));
    if (p.activeHandIndex < 0) p.activeHandIndex = 0;
    normalizeHandsForSeat(p);
    s.lastActivityAt = now;
    s.turnEndsAt = now + turnDurationMs(s);
    s.updatedAt = now;
    return { state: s };
  }

  if (action.type === "stand") {
    h.turnEnded = true;
    h.stood = true;
    s.lastActivityAt = now;
    normalizeHandsForSeat(p);
    return { state: advanceTurn(s, now) };
  }

  return { state: s, error: "Unknown action." };
}

export function applyVoteSkipTurn(state: TableState, userId: number, now: number): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "No active turn timer." };
  const turnSeatIdx = currentTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  if (p.userId !== userId) return { state: s, error: "Only the current player can skip the timer." };
  normalizeHandsForSeat(p);
  const h = p.hands[p.activeHandIndex]!;
  h.turnEnded = true;
  h.stood = true;
  normalizeHandsForSeat(p);
  s.lastActivityAt = now;
  return { state: advanceTurn(s, now) };
}

export function applyExtendTurnTimer(
  state: TableState,
  userId: number,
  now: number,
): { state: TableState; error?: string } {
  const s = tickTable(state, now);
  if (s.phase !== "player_turns") return { state: s, error: "No active turn timer." };
  const turnSeatIdx = currentTurnSeatIndex(s);
  if (turnSeatIdx == null) return { state: s, error: "No active turn." };
  const p = s.seats[turnSeatIdx];
  if (!p) return { state: s, error: "Turn seat empty." };
  if (p.userId !== userId) return { state: s, error: "Not your turn." };
  if (p.extendUsedThisTurn) return { state: s, error: "Extend already used this turn." };
  p.extendUsedThisTurn = true;
  // Add 15 seconds to current timer (or reset to now+15s if it already expired).
  s.turnEndsAt = Math.max(s.turnEndsAt, now) + 15_000;
  s.lastActivityAt = now;
  s.updatedAt = now;
  return { state: s };
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
  actor.inventory = normalizeInventory(actor.inventory);
  normalizeHandsForSeat(actor);
  const def = SPECIALS[input.id];
  if (!def) return { state: s, error: "Unknown special." };
  const cat = classifySpecial(input.id);
  if ((s.disabledCategories ?? []).includes(cat)) {
    return { state: s, error: "That powerup category is disabled for this table." };
  }
  if (invGet(actor.inventory, input.id) <= 0) return { state: s, error: "No charges left." };
  // Some specials are limited to once per round; others can stack if you have charges.
  const singleUsePerRound = new Set<SpecialId>([
    "PEEK_NEXT",
    "SWAP_ONE",
    "DOUBLE_PAYOUT",
    "DEALER_SECOND_CHANCE",
    "BJ_PROTECTOR",
    "MYTHIC_COPY_HANDS",
  ]);
  if (singleUsePerRound.has(input.id) && actor.usedThisRound?.[input.id]) {
    return { state: s, error: "Already used this round." };
  }

  const isOwnTurn =
    s.phase === "player_turns" && currentTurnSeatIndex(s) != null && s.seats[currentTurnSeatIndex(s)!]?.userId === userId;
  // "Anytime" magic cards are allowed any time before the end of the round:
  // during player turns, dealer phase, and the dealer-window (but not after settling starts).
  const isBeforeEndOfRound = s.phase === "player_turns" || s.phase === "dealer" || s.phase === "dealer_window";
  const isBetting = s.phase === "betting";

  if (def.timing === "betting" && !isBetting) return { state: s, error: "Only usable during betting." };
  if (def.timing === "own_turn" && !isOwnTurn) return { state: s, error: "Only usable on your turn." };
  if (def.timing === "dealer_window" && s.phase !== "dealer_window") return { state: s, error: "Only usable after dealer stands." };
  if (def.timing === "anytime" && !isBeforeEndOfRound) return { state: s, error: "Only usable before the end of the round." };

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
    // Allow targeting dealer with a sentinel -1 from UI.
    const tuidRaw = input.targetUserId ?? userId;
    const tuid = Number(tuidRaw);
    if (tuid === -1) {
      targetSeat = null;
      targetSeatIdx = null;
    } else {
      const idx = s.seats.findIndex((p) => p?.userId === tuid);
      if (idx < 0) return { state: s, error: "Target not seated." };
      targetSeat = s.seats[idx]!;
      targetSeatIdx = idx;
    }
  }

  // Apply effects
  if (input.id === "ADD2_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += 2;
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) {
      // Allow save cards before the turn is over.
      h.busted = true;
    }
  } else if (input.id === "ADD1_SELF") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += 1;
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) h.busted = true;
  } else if (input.id === "PEEK_NEXT") {
    const next = s.shoe[s.shoe.length - 1];
    s.peekByUserId[String(userId)] = typeof next === "number" ? next : null;
  } else if (input.id === "BJ_PROTECTOR") {
    actor.bjProtected = true;
  } else if (input.id === "FREE_SPLIT") {
    return { state: s, error: "This powerup is consumed automatically when you Split." };
  } else if (input.id === "SWAP_ONE") {
    const h = actor.hands[actor.activeHandIndex]!;
    if (h.cards.length === 0) return { state: s, error: "No cards to swap." };
    const next = drawFromShoe(s);
    if (next == null) return { state: s, error: "Shoe empty." };
    // swap the last card
    h.cards[h.cards.length - 1] = next;
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t > 21) h.busted = true;
  } else if (input.id === "DOUBLE_PAYOUT") {
    const h = actor.hands[actor.activeHandIndex]!;
    h.doublePayoutArmed = true;
  } else if (input.id === "ADD2_DEALER") {
    s.dealer.bonusPoints += 2;
  } else if (input.id === "DEALER_SECOND_CHANCE") {
    s.dealer.secondChanceArmed = true;
  } else if (input.id === "ADD2_TARGET") {
    if (!targetSeat) {
      // dealer target
      s.dealer.bonusPoints += 2;
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.bonusPoints += 2;
      const t = handTotal(th.cards, th.bonusPoints).total;
      if (t > 21) th.busted = true;
    }
  } else if (input.id === "FORCE_HIT_TARGET") {
    const c = drawFromShoe(s);
    if (c == null) return { state: s, error: "Shoe empty." };
    if (!targetSeat) {
      s.dealer.cards.push(c);
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.cards.push(c);
      const t = handTotal(th.cards, th.bonusPoints).total;
      if (t > 21) th.busted = true;
    }
  } else if (input.id === "ADD1_MAGIC" || input.id === "ADD2_MAGIC") {
    const delta = input.id === "ADD1_MAGIC" ? 1 : 2;
    if (!targetSeat) {
      s.dealer.bonusPoints += delta;
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.bonusPoints += delta;
      const t = handTotal(th.cards, th.bonusPoints).total;
      if (t > 21) th.busted = true;
    }
  } else if (
    input.id === "MAGIC_ACE" ||
    input.id === "MAGIC_KING" ||
    input.id === "MAGIC_QUEEN" ||
    input.id === "MAGIC_JACK" ||
    input.id === "MAGIC_JOKER"
  ) {
    const rank: MagicRank =
      input.id === "MAGIC_ACE"
        ? "A"
        : input.id === "MAGIC_KING"
          ? "K"
          : input.id === "MAGIC_QUEEN"
            ? "Q"
            : input.id === "MAGIC_JACK"
              ? "J"
              : "JOKER";
    const suitIdx = Math.floor(lcg(Math.floor(now / 1000) ^ (seatIdx * 1337) ^ (s.round * 4242))() * 4);
    const magicCard = encodeMagicCard(rank, suitIdx);
    if (!targetSeat) {
      s.dealer.cards.push(magicCard);
    } else {
      targetSeat.inventory = normalizeInventory(targetSeat.inventory);
      normalizeHandsForSeat(targetSeat);
      const th = targetSeat.hands[targetSeat.activeHandIndex]!;
      th.cards.push(magicCard);
      const t = handTotal(th.cards, th.bonusPoints).total;
      if (t > 21) th.busted = true;
    }
  } else if (input.id === "MYTHIC_COPY_HANDS") {
    if (!targetSeat) return { state: s, error: "Choose a player to copy." };
    normalizeHandsForSeat(targetSeat);
    const copyFrom = targetSeat.hands[targetSeat.activeHandIndex]!;
    for (const other of s.seats) {
      if (!other) continue;
      normalizeHandsForSeat(other);
      // Copy to ALL players (including the actor) except dealer; keep bet, reset statuses to continue round.
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
      input.id === "SUB1_SELF" ? -1 : input.id === "SUB2_SELF" ? -2 : input.id === "SUB5_SELF" ? -5 : -10;
    const h = actor.hands[actor.activeHandIndex]!;
    h.bonusPoints += delta;
    const t = handTotal(h.cards, h.bonusPoints).total;
    if (t <= 21) h.busted = false;
  }

  if (singleUsePerRound.has(input.id)) actor.usedThisRound[input.id] = true;
  if (!invConsume(actor.inventory, input.id)) return { state: s, error: "No charges left." };
  actor.lastSeenAt = now;
  s.lastActivityAt = now;
  // Reset turn timer on irreversible action (using a powerup on your own turn).
  if (isOwnTurn) s.turnEndsAt = now + turnDurationMs(s);

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
      settlements: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
      ppSettlements: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
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
    const settlements: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }> = [];
    const ppSettlements: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }> = [];
    let anySevenCardWinOrPush = false;

    // Evaluate each hand vs dealer; choose the best multiplier for player reporting.
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

      // Card-count bonus rules:
      // - 6+ cards without busting: if you would have LOST, treat as push instead ("push on lost").
      // - Extra 2:1 bonus is ONLY for wins:
      //   if you WIN with 5 cards => +2x; each additional card adds another +2x.
      if (!isDealerBJ && pTotal <= 21) {
        const cards = h.cards.length;
        if (cards >= 6 && mult === 0) {
          mult = 1;
          outcome = `Push (6+ cards)`;
        }
        if (mult > 1 && cards >= 5) {
          const bonus = 2 * (cards - 4);
          mult += bonus;
          outcome += ` +${bonus.toFixed(0)}x (cards)`;
        }
        if (cards >= 7 && mult >= 1) anySevenCardWinOrPush = true;
      }

      // Apply double payout after bonuses.
      if (h.doublePayoutArmed && mult > 1) mult *= 2;

      // Perfect Pairs (side bet) — evaluated on the first 2 cards of EACH hand.
      if (
        !h.perfectPairsSettled &&
        (h.perfectPairsWager ?? 0) > 0 &&
        h.perfectPairsNonce != null &&
        Number.isFinite(Number(h.perfectPairsNonce)) &&
        Number(h.perfectPairsNonce) >= 0
      ) {
        if (h.cards.length >= 2) {
          const ppm = perfectPairsMultiplier(h.cards[0]!, h.cards[1]!);
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

      // Create settlements for wallet nonces backing this hand.
      const nonces = Array.isArray(h.nonces) ? h.nonces.filter((x) => Number.isFinite(x) && x >= 0) : [];
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

    // If you won (net positive), keep your base bet in play for next round (auto re-bet).
    if (mAll > 1) p.carryBetNext = Number(p.lastBetPlaced ?? p.hands?.[0]?.bet ?? 0) || 0;
    else p.carryBetNext = 0;

    mythicDropAny = mythicDropAny || anySevenCardWinOrPush;

    // Box distribution:
    // Every 3 hands played, award a normal box.
    p.inventory.handsPlayed = Number(p.inventory.handsPlayed ?? 0) + 1;
    if (p.inventory.handsPlayed % 3 === 0) {
      const seed = Math.floor(now / 1000) ^ (s.round * 1103515245) ^ (p.userId * 2654435761);
      const box = rollBox("normal", seed);
      p.inventory.boxes = p.inventory.boxes ?? [];
      p.inventory.boxes.push({
        id: shortId(),
        tier: "normal",
        awardedAt: now,
        opened: false,
        contents: box,
      });
    }

    results[String(p.userId)] = { outcome: bestOutcome, multiplier: mAll, wager: totalWager, settlements, ppSettlements };
  }

  // Mythic box drop (table-wide) if anyone achieved 7-card push or win.
  if (mythicDropAny) {
    for (const seatIdx of s.participants) {
      const p = s.seats[seatIdx];
      if (!p) continue;
      p.inventory = normalizeInventory(p.inventory);
      const seed = Math.floor(now / 1000) ^ (s.round * 2246822519) ^ (p.userId * 3266489917);
      const box = rollBox("mythic", seed);
      p.inventory.boxes = p.inventory.boxes ?? [];
      p.inventory.boxes.push({
        id: shortId(),
        tier: "mythic",
        awardedAt: now,
        opened: false,
        contents: box,
      });
    }
  }

  s.lastResults = results;
  s.phase = "settling";
  s.bettingEndsAt = now + 4_000; // short intermission then betting
  s.dealerWindowEndsAt = 0;
  s.updatedAt = now;
  return s;
}

export function safePublicStateForUser(state: TableState, userId: number) {
  // Never leak table password to clients.
  const { password: _pw, ...rest } = state as any;
  const meSeat = state.seats.find((p) => p?.userId === userId) ?? null;
  const peek = state.peekByUserId[String(userId)] ?? null;
  // hide dealer hole card during player turns
  const hideDealerHole = state.phase === "player_turns";
  const dealerCards = hideDealerHole ? state.dealer.cards.map((c, i) => (i === 1 ? -1 : c)) : state.dealer.cards;

  return {
    ...rest,
    dealer: { ...state.dealer, cards: dealerCards },
    // spectators list is fine
    peekCard: peek,
    meSeatIndex: state.seats.findIndex((p) => p?.userId === userId),
    meInventory: meSeat?.inventory ?? null,
    lastResult: state.lastResults?.[String(userId)] ?? null,
  };
}
