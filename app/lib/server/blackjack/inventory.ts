"server-only";

import {
  BLACKJACK,
  BOX_TIER,
  type BoxTier,
} from "../../shared/constants";
import type {
  BlackjackInventory as Inventory,
  InventoryCategoryId,
  InventoryBox,
  SpecialId,
  SpecialRarity,
  SpecialTiming,
  SpecialTarget,
  SpecialDef,
} from "../../shared/types";
import { lcg } from "./cards";

// ---------------------------------------------------------------------------
// Powerup catalog (SPECIALS definitions)
// ---------------------------------------------------------------------------

export type { SpecialId, SpecialRarity, SpecialTiming, SpecialTarget, SpecialDef };

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  ADD2_SELF: {
    id: "ADD2_SELF",
    name: "+2 (You)",
    shortName: "+2",
    desc: "Add +2 to your hand total. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  ADD1_SELF: {
    id: "ADD1_SELF",
    name: "+1 (You)",
    shortName: "+1",
    desc: "Add +1 to your hand total. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  PEEK_NEXT: {
    id: "PEEK_NEXT",
    name: "Peek",
    shortName: "👀➡️",
    desc: "Peek the next card on top of the shoe. Only usable on your turn.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  BJ_PROTECTOR: {
    id: "BJ_PROTECTOR",
    name: "BJ Protector",
    shortName: "BJ🚫",
    desc: "Protect yourself from dealer blackjack this round (push instead of lose). Only usable during betting phase.",
    rarity: "rare",
    timing: "betting",
    target: "self",
  },
  FREE_SPLIT: {
    id: "FREE_SPLIT",
    name: "Free Split",
    shortName: "SPLIT",
    desc: "Legendary: allows you to split ANY starting 2 cards (even if ranks don't match). Consumed when you split.",
    rarity: "legendary",
    timing: "anytime",
    target: "self",
  },
  SWAP_ONE: {
    id: "SWAP_ONE",
    name: "Swap",
    shortName: "SWAP",
    desc: "Swap one of your cards with the next card from the shoe. Only usable on your turn.",
    rarity: "rare",
    timing: "own_turn",
    target: "self",
  },
  DOUBLE_PAYOUT: {
    id: "DOUBLE_PAYOUT",
    name: "Double Payout",
    shortName: "x2",
    desc: "If you win this round, double your payout multiplier. Only usable during betting phase.",
    rarity: "common",
    timing: "betting",
    target: "self",
  },
  REMOVE_RANDOM_SELF: {
    id: "REMOVE_RANDOM_SELF",
    name: "Remove Random",
    shortName: "DEL🎲",
    desc: "Remove a random card from your current hand. Rare. Only usable on your turn.",
    rarity: "rare",
    timing: "own_turn",
    target: "self",
  },
  REMOVE_CARD_SELF: {
    id: "REMOVE_CARD_SELF",
    name: "Remove Card",
    shortName: "DEL🎯",
    desc: "Choose and remove a specific card from your current hand. Legendary. Only usable on your turn.",
    rarity: "legendary",
    timing: "own_turn",
    target: "self",
  },
  ADD2_DEALER: {
    id: "ADD2_DEALER",
    name: "+2 (Dealer)",
    shortName: "D+2",
    desc: "Add +2 to the dealer total. Usable after dealer stands and before next round.",
    rarity: "rare",
    timing: "dealer_window",
    target: "dealer",
  },
  DEALER_SECOND_CHANCE: {
    id: "DEALER_SECOND_CHANCE",
    name: "Dealer Second Chance",
    shortName: "2nd",
    desc: "If dealer busts, reduce dealer total by 10 once. Usable after dealer stands.",
    rarity: "rare",
    timing: "dealer_window",
    target: "dealer",
  },
  ADD2_TARGET: {
    id: "ADD2_TARGET",
    name: "+2 (Target)",
    shortName: "+2",
    desc: "Add +2 to any player's hand total. Rare. Can be used even when it's not your turn (before dealer stands).",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  FORCE_HIT_TARGET: {
    id: "FORCE_HIT_TARGET",
    name: "Force Hit",
    shortName: "HIT",
    desc: "Force any player to draw 1 card immediately. Rare. Can be used even when it's not your turn (before dealer stands).",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  ADD1_MAGIC: {
    id: "ADD1_MAGIC",
    name: "+1 Magic",
    shortName: "+1★",
    desc: "Summon 1 random card into a selected hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  ADD2_MAGIC: {
    id: "ADD2_MAGIC",
    name: "+2 Magic",
    shortName: "+2★",
    desc: "Summon 2 random cards into a selected hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  SUB1_SELF: {
    id: "SUB1_SELF",
    name: "-1 (Save)",
    shortName: "-1",
    desc: "Subtract 1 from your total. Can save you from bust as long as your turn is not over.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  SUB2_SELF: {
    id: "SUB2_SELF",
    name: "-2 (Save)",
    shortName: "-2",
    desc: "Subtract 2 from your total. Can save you from bust as long as your turn is not over.",
    rarity: "common",
    timing: "own_turn",
    target: "self",
  },
  SUB5_SELF: {
    id: "SUB5_SELF",
    name: "-5 (Save)",
    shortName: "-5",
    desc: "Subtract 5 from your total. Rare. Can save you from bust as long as your turn is not over.",
    rarity: "rare",
    timing: "own_turn",
    target: "self",
  },
  SUB10_SELF: {
    id: "SUB10_SELF",
    name: "-10 (Save)",
    shortName: "-10",
    desc: "Subtract 10 from your total. Very rare. Can save you from bust as long as your turn is not over.",
    rarity: "legendary",
    timing: "own_turn",
    target: "self",
  },
  MAGIC_ACE: {
    id: "MAGIC_ACE",
    name: "Magic Ace",
    shortName: "A★",
    desc: "Summon an Ace into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_KING: {
    id: "MAGIC_KING",
    name: "Magic King",
    shortName: "K★",
    desc: "Summon a King into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_QUEEN: {
    id: "MAGIC_QUEEN",
    name: "Magic Queen",
    shortName: "Q★",
    desc: "Summon a Queen into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_JACK: {
    id: "MAGIC_JACK",
    name: "Magic Jack",
    shortName: "J★",
    desc: "Summon a Jack into anybody’s hand (including dealer). Rare magic. Usable any time before the end of the round.",
    rarity: "rare",
    timing: "anytime",
    target: "any",
  },
  MAGIC_JOKER: {
    id: "MAGIC_JOKER",
    name: "Magic Joker",
    shortName: "🃏★",
    desc: "Summon a Joker into anybody’s hand (including dealer). Legendary magic. Joker counts as 0. Usable any time before end of round.",
    rarity: "legendary",
    timing: "anytime",
    target: "any",
  },
  MYTHIC_COPY_HANDS: {
    id: "MYTHIC_COPY_HANDS",
    name: "Mythic: Copy Hands",
    shortName: "COPY",
    desc: "MYTHIC: Copy a chosen player's current hand to EVERYONE (except dealer). Usable any time before end of round.",
    rarity: "mythic",
    timing: "anytime",
    target: "any",
  },
};

export const SPECIAL_IDS = Object.keys(SPECIALS) as SpecialId[];

export function specialLabel(id: SpecialId): string {
  const d = SPECIALS[id];
  return (d?.shortName ?? d?.name ?? String(id)).slice(0, 12);
}

export function rarityOf(id: SpecialId): SpecialRarity {
  return (SPECIALS[id]?.rarity ?? "common") as SpecialRarity;
}

export function classifySpecial(id: SpecialId): InventoryCategoryId {
  if (id === "MYTHIC_COPY_HANDS") return "mythic";
  if (id.startsWith("MAGIC_") || id.includes("_MAGIC")) return "magic";
  if (id.startsWith("REMOVE_")) return "utility";
  if (id.startsWith("SUB")) return "saves";
  if (id.includes("DEALER")) return "dealer";
  if (
    id === "PEEK_NEXT" ||
    id === "SWAP_ONE" ||
    id === "FORCE_HIT_TARGET" ||
    id === "BJ_PROTECTOR" ||
    id === "FREE_SPLIT"
  ) {
    return "utility";
  }
  return "boosts";
}

const KNOWN_SPECIAL_IDS: Record<SpecialId, true> = Object.fromEntries(
  SPECIAL_IDS.map((id) => [id, true]),
) as Record<SpecialId, true>;

// ---------------------------------------------------------------------------
// Inventory normalization (v1/v2 -> v3 migration) and accessors
// ---------------------------------------------------------------------------

function baseInventory(): Inventory {
  return {
    v: 3,
    handsPlayed: 0,
    bonusPoints: 0,
    allInWinStreak: 0,
    categories: { boosts: {}, saves: {}, utility: {}, magic: {}, dealer: {}, mythic: {} },
    boxes: [],
    bond: { owned: 0, active: null },
    collectibles: { owned: {}, figurines: [], placed: [] },
  };
}

function normalizeCategories(raw: unknown): Inventory["categories"] {
  const cats = (raw ?? {}) as Record<string, unknown>;
  return {
    boosts: (cats.boosts ?? {}) as Record<string, number>,
    saves: (cats.saves ?? {}) as Record<string, number>,
    utility: (cats.utility ?? {}) as Record<string, number>,
    magic: (cats.magic ?? {}) as Record<string, number>,
    dealer: (cats.dealer ?? {}) as Record<string, number>,
    mythic: (cats.mythic ?? {}) as Record<string, number>,
  };
}

function normalizeBoxes(raw: unknown): InventoryBox[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((b) => {
    const tier = (
      b?.tier === "rare" || b?.tier === "legendary" || b?.tier === "mythic" ? b.tier : "normal"
    ) as BoxTier;
    return {
      id: String(b?.id ?? ""),
      tier,
      awardedAt: Number(b?.awardedAt ?? 0) || 0,
      openedAt: b?.openedAt != null ? Number(b.openedAt) : undefined,
      opened: !!b?.opened,
      contents: Array.isArray(b?.contents) ? (b.contents as string[]) : undefined,
      source: b?.source != null ? String(b.source) : undefined,
    };
  });
}

function normalizeCollectibles(raw: unknown): Inventory["collectibles"] {
  const colRaw = (raw ?? {}) as Record<string, unknown>;
  const ownedRaw = (colRaw?.owned ?? {}) as Record<string, unknown>;
  const figurinesRaw = colRaw?.figurines ?? [];
  const placedRaw = colRaw?.placed ?? [];
  return {
    owned:
      ownedRaw && typeof ownedRaw === "object"
        ? Object.fromEntries(
            Object.entries(ownedRaw).map(([k, v]) => [
              String(k),
              Math.max(0, Math.floor(Number(v ?? 0) || 0)),
            ]),
          )
        : {},
    figurines: Array.isArray(figurinesRaw)
      ? (figurinesRaw as Record<string, unknown>[]).flatMap((f) => {
          const id = String(f?.id ?? "");
          const imageUrl = String(f?.imageUrl ?? "");
          if (!id || !imageUrl) return [];
          return [{ id, imageUrl, createdAt: Number(f?.createdAt ?? 0) || 0 }];
        })
      : [],
    placed: Array.isArray(placedRaw)
      ? (placedRaw as Record<string, unknown>[]).flatMap((p) => {
          const id = String(p?.id ?? "");
          const kind = String(p?.kind ?? "");
          if (!id || (kind !== "emoji" && kind !== "figurine")) return [];
          const x = Number(p?.x ?? 0.5);
          const y = Number(p?.y ?? 0.5);
          return [
            {
              id,
              ownerUserId: String(p?.ownerUserId ?? ""),
              kind: kind as "emoji" | "figurine",
              key: p?.key != null ? String(p.key) : undefined,
              imageUrl: p?.imageUrl != null ? String(p.imageUrl) : undefined,
              x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5,
              y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5,
              placedAt: Number(p?.placedAt ?? 0) || 0,
              createdAt: Number(p?.createdAt ?? p?.placedAt ?? 0) || 0,
            },
          ];
        })
      : [],
  };
}

export function normalizeInventory(raw: unknown): Inventory {
  const r = raw as Record<string, unknown> | null;
  if (r && r.v === 3 && r.categories) {
    const bondRaw = (r.bond ?? {}) as Record<string, unknown>;
    const active = bondRaw?.active as Record<string, unknown> | null;
    return {
      v: 3,
      handsPlayed: Number(r.handsPlayed ?? 0) || 0,
      bonusPoints: Math.max(0, Math.floor(Number(r.bonusPoints ?? 0) || 0)),
      allInWinStreak: Math.max(0, Math.floor(Number(r.allInWinStreak ?? 0) || 0)),
      categories: normalizeCategories(r.categories),
      boxes: normalizeBoxes(r.boxes),
      bond: {
        owned: Math.max(0, Math.floor(Number(bondRaw?.owned ?? 0) || 0)),
        active: active
          ? {
              principal: Math.max(0, Number(active?.principal ?? 0) || 0),
              value: Math.max(0, Number(active?.value ?? 0) || 0),
              startedAt: Number(active?.startedAt ?? 0) || 0,
              lastAccrualAt: Number(active?.lastAccrualAt ?? active?.startedAt ?? 0) || 0,
            }
          : null,
      },
      collectibles: normalizeCollectibles(r.collectibles),
    };
  }

  if (r && r.v === 2 && r.categories) {
    return {
      v: 3,
      handsPlayed: Number(r.handsPlayed ?? 0) || 0,
      bonusPoints: Math.max(0, Math.floor(Number(r.bonusPoints ?? 0) || 0)),
      allInWinStreak: Math.max(0, Math.floor(Number(r.allInWinStreak ?? 0) || 0)),
      categories: normalizeCategories(r.categories),
      boxes: normalizeBoxes(r.boxes),
      bond: { owned: 0, active: null },
      collectibles: { owned: {}, figurines: [], placed: [] },
    };
  }

  // Legacy v1: flat { powerupId: count } object.
  const inv = baseInventory();
  if (r && typeof r === "object") {
    for (const [k, v] of Object.entries(r)) {
      const id = k as SpecialId;
      if (!(id in KNOWN_SPECIAL_IDS)) continue;
      const n = Number(v ?? 0);
      if (!Number.isFinite(n) || n < 0) continue;
      const cat = classifySpecial(id);
      inv.categories[cat][id] = (inv.categories[cat][id] ?? 0) + n;
    }
  }
  return inv;
}

export function ensureInventory(raw: unknown): Inventory {
  return normalizeInventory(raw);
}

// When a player is AFK-kicked, their placed felt decorations return to inventory.
export function returnPlacedCollectiblesToInventory(
  invRaw: unknown,
  decorations: unknown[] | null,
  now: number,
): Inventory {
  const inv = normalizeInventory(invRaw);
  inv.collectibles = inv.collectibles ?? { owned: {}, figurines: [], placed: [] };
  inv.collectibles.owned = inv.collectibles.owned ?? {};
  inv.collectibles.figurines = Array.isArray(inv.collectibles.figurines)
    ? inv.collectibles.figurines
    : [];
  inv.collectibles.placed = Array.isArray(inv.collectibles.placed) ? inv.collectibles.placed : [];

  const owned = inv.collectibles.owned as Record<string, number>;
  const figs = inv.collectibles.figurines;
  const placed = inv.collectibles.placed as unknown as Record<string, unknown>[];
  const decoList = Array.isArray(decorations) ? (decorations as Record<string, unknown>[]) : [];

  for (const p of placed) {
    const kind = String(p?.kind ?? "emoji") === "figurine" ? "figurine" : "emoji";
    if (kind === "emoji") {
      const key = String(p?.key ?? "").trim();
      if (!key) continue;
      owned[key] = Math.max(0, Math.floor(Number(owned[key] ?? 0) || 0) + 1);
    } else {
      const id = String(p?.key ?? p?.id ?? "").trim();
      const decoId = String(p?.id ?? "").trim();
      let imageUrl = String(p?.imageUrl ?? "").trim();
      if (!imageUrl && decoId) {
        const deco = decoList.find((d) => String(d?.id ?? "") === decoId);
        imageUrl = String(deco?.imageUrl ?? "").trim();
      }
      if (id && imageUrl) figs.push({ id, imageUrl, createdAt: Number(p?.placedAt ?? now) || now });
    }
  }

  inv.collectibles.owned = owned;
  inv.collectibles.figurines = figs;
  inv.collectibles.placed = [];
  return inv;
}

export function unopenedBoxCount(inv: Inventory): number {
  return (inv.boxes ?? []).filter((b) => !b.opened).length;
}

export function invGet(inv: Inventory, id: SpecialId): number {
  const cat = classifySpecial(id);
  return Number(inv.categories?.[cat]?.[id] ?? 0);
}

export function invAdd(inv: Inventory, id: SpecialId, amount: number): void {
  const cat = classifySpecial(id);
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return;
  inv.categories[cat][id] = Math.max(0, (inv.categories[cat][id] ?? 0) + n);
}

export function invConsume(inv: Inventory, id: SpecialId): boolean {
  if (invGet(inv, id) <= 0) return false;
  invAdd(inv, id, -1);
  return true;
}

export function defaultInventory(): Inventory {
  const inv = baseInventory();
  inv.collectibles = {
    owned: { SODA_CUP: 1, CHICKEN_WING: 1, FRIES: 1, DICE: 1 },
    figurines: [],
    placed: [],
  };
  invAdd(inv, "ADD2_SELF", 1);
  invAdd(inv, "ADD1_SELF", 1);
  invAdd(inv, "PEEK_NEXT", 1);
  invAdd(inv, "DOUBLE_PAYOUT", 1);
  invAdd(inv, "SUB1_SELF", 1);
  invAdd(inv, "BJ_PROTECTOR", 1);
  return inv;
}

// ---------------------------------------------------------------------------
// Box rolling (deterministic, seeded). Matches legacy drop weights exactly.
// ---------------------------------------------------------------------------

export function randSpecial(seed: number, rarity: SpecialRarity): SpecialId {
  const pool = Object.values(SPECIALS)
    .filter((s) => s.rarity === rarity)
    .map((s) => s.id);
  const r = (() => {
    let s = seed >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s % 1_000_000) / 1_000_000;
  })();
  return pool[Math.floor(r * pool.length)] ?? "ADD2_SELF";
}

export function rollBox(tier: BoxTier, seed: number): SpecialId[] {
  const rand = lcg(seed);

  const weightedPick = (pool: { id: SpecialId; w: number }[], exclude: Set<SpecialId>): SpecialId => {
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

  if (tier === BOX_TIER.MYTHIC) {
    const pool = Object.values(SPECIALS)
      .filter((s) => s.rarity === "mythic")
      .map((s) => ({ id: s.id, w: 1 }));
    return [weightedPick(pool, new Set())];
  }

  if (tier === BOX_TIER.LEGENDARY) {
    const pool = Object.values(SPECIALS)
      .filter((s) => s.rarity === "legendary")
      .map((s) => ({ id: s.id, w: 1 }));
    return [weightedPick(pool, new Set())];
  }

  if (tier === BOX_TIER.RARE) {
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
  for (let i = 0; i < 3; i += 1) {
    const id = weightedPick(pool, used);
    out.push(id);
    used.add(id);
  }
  return out;
}

export { BLACKJACK };
