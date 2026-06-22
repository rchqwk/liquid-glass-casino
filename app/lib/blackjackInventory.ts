"server-only";

import type { SpecialId } from "./blackjackMultiplayer";

export type InventoryCategoryId = "boosts" | "saves" | "utility" | "magic" | "dealer" | "mythic";

export type Inventory = {
  v: 3;
  handsPlayed: number;
  bonusPoints: number;
  allInWinStreak: number;
  categories: Record<InventoryCategoryId, Partial<Record<SpecialId, number>>>;
  boxes: Array<{
    id: string;
    tier: "normal" | "rare" | "legendary" | "mythic";
    awardedAt: number;
    openedAt?: number;
    opened: boolean;
    contents?: SpecialId[];
  }>;
  bond?: {
    owned: number;
    active?: {
      principal: number;
      value: number;
      startedAt: number;
      lastAccrualAt: number;
    } | null;
  };
  collectibles?: {
    owned: Record<string, number>;
    figurines: Array<{ id: string; imageUrl: string; createdAt: number }>;
    placed?: Array<{
      id: string;
      kind: "emoji" | "figurine";
      key?: string;
      imageUrl?: string;
      x: number;
      y: number;
      placedAt: number;
    }>;
  };
};

const KNOWN_SPECIAL_IDS: Record<SpecialId, true> = {
  ADD2_SELF: true,
  ADD1_SELF: true,
  PEEK_NEXT: true,
  BJ_PROTECTOR: true,
  FREE_SPLIT: true,
  SWAP_ONE: true,
  DOUBLE_PAYOUT: true,
  REMOVE_CARD_SELF: true,
  REMOVE_RANDOM_SELF: true,
  ADD2_DEALER: true,
  DEALER_SECOND_CHANCE: true,
  ADD2_TARGET: true,
  FORCE_HIT_TARGET: true,
  ADD1_MAGIC: true,
  ADD2_MAGIC: true,
  SUB1_SELF: true,
  SUB2_SELF: true,
  SUB5_SELF: true,
  SUB10_SELF: true,
  MAGIC_ACE: true,
  MAGIC_KING: true,
  MAGIC_QUEEN: true,
  MAGIC_JACK: true,
  MAGIC_JOKER: true,
  MYTHIC_COPY_HANDS: true,
};

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

function normalizeCategories(raw: any) {
  const cats = raw ?? {};
  return {
    boosts: (cats.boosts ?? {}) as any,
    saves: (cats.saves ?? {}) as any,
    utility: (cats.utility ?? {}) as any,
    magic: (cats.magic ?? {}) as any,
    dealer: (cats.dealer ?? {}) as any,
    mythic: (cats.mythic ?? {}) as any,
  };
}

function normalizeBoxes(raw: any) {
  return Array.isArray(raw)
    ? (raw as any[]).map((b) => ({
        id: String(b?.id ?? ""),
        tier: (b?.tier === "rare" || b?.tier === "legendary" || b?.tier === "mythic" ? b.tier : "normal") as any,
        awardedAt: Number(b?.awardedAt ?? 0) || 0,
        openedAt: b?.openedAt != null ? Number(b.openedAt) : undefined,
        opened: !!b?.opened,
        contents: Array.isArray(b?.contents) ? (b.contents as SpecialId[]) : undefined,
      }))
    : [];
}

function normalizeCollectibles(raw: any) {
  const colRaw = raw ?? {};
  const ownedRaw = colRaw?.owned ?? {};
  const figurinesRaw = colRaw?.figurines ?? [];
  const placedRaw = colRaw?.placed ?? [];
  return {
    owned:
      ownedRaw && typeof ownedRaw === "object"
        ? Object.fromEntries(
            Object.entries(ownedRaw).map(([k, v]) => [String(k), Math.max(0, Math.floor(Number(v ?? 0) || 0))]),
          )
        : {},
    figurines: Array.isArray(figurinesRaw)
      ? (figurinesRaw as any[]).flatMap((f) => {
          const id = String(f?.id ?? "");
          const imageUrl = String(f?.imageUrl ?? "");
          if (!id || !imageUrl) return [];
          return [{ id, imageUrl, createdAt: Number(f?.createdAt ?? 0) || 0 }];
        })
      : [],
    placed: Array.isArray(placedRaw)
      ? (placedRaw as any[]).flatMap((p) => {
          const id = String(p?.id ?? "");
          const kind = String(p?.kind ?? "");
          if (!id || (kind !== "emoji" && kind !== "figurine")) return [];
          const x = Number(p?.x ?? 0.5);
          const y = Number(p?.y ?? 0.5);
          return [
            {
              id,
              kind: kind as any,
              key: p?.key != null ? String(p.key) : undefined,
              imageUrl: p?.imageUrl != null ? String(p.imageUrl) : undefined,
              x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5,
              y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5,
              placedAt: Number(p?.placedAt ?? 0) || 0,
            },
          ];
        })
      : [],
  };
}

export function normalizeInventory(raw: any): Inventory {
  if (raw && raw.v === 3 && raw.categories) {
    const bondRaw = raw.bond ?? {};
    const active = bondRaw?.active ?? null;
    return {
      v: 3,
      handsPlayed: Number(raw.handsPlayed ?? 0) || 0,
      bonusPoints: Math.max(0, Math.floor(Number(raw.bonusPoints ?? 0) || 0)),
      allInWinStreak: Math.max(0, Math.floor(Number(raw.allInWinStreak ?? 0) || 0)),
      categories: normalizeCategories(raw.categories),
      boxes: normalizeBoxes(raw.boxes),
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
      collectibles: normalizeCollectibles(raw.collectibles),
    };
  }

  if (raw && raw.v === 2 && raw.categories) {
    return {
      v: 3,
      handsPlayed: Number(raw.handsPlayed ?? 0) || 0,
      bonusPoints: Math.max(0, Math.floor(Number(raw.bonusPoints ?? 0) || 0)),
      allInWinStreak: Math.max(0, Math.floor(Number(raw.allInWinStreak ?? 0) || 0)),
      categories: normalizeCategories(raw.categories),
      boxes: normalizeBoxes(raw.boxes),
      bond: { owned: 0, active: null },
      collectibles: { owned: {}, figurines: [], placed: [] },
    };
  }

  const inv = baseInventory();
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
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

export function ensureInventory(raw: any): Inventory {
  return normalizeInventory(raw);
}

export function returnPlacedCollectiblesToInventory(invRaw: any, decorations: any[] | null, now: number): Inventory {
  const inv = normalizeInventory(invRaw);
  inv.collectibles = inv.collectibles ?? { owned: {}, figurines: [], placed: [] };
  inv.collectibles.owned = inv.collectibles.owned ?? {};
  inv.collectibles.figurines = Array.isArray(inv.collectibles.figurines) ? inv.collectibles.figurines : [];
  inv.collectibles.placed = Array.isArray(inv.collectibles.placed) ? inv.collectibles.placed : [];

  const owned = inv.collectibles.owned as Record<string, number>;
  const figs = inv.collectibles.figurines as Array<{ id: string; imageUrl: string; createdAt: number }>;
  const placed = inv.collectibles.placed as Array<any>;
  const decoList = Array.isArray(decorations) ? decorations : [];

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
        const deco = decoList.find((d: any) => String(d?.id ?? "") === decoId);
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

export function unopenedBoxCount(inv: Inventory) {
  return (inv.boxes ?? []).filter((b) => !b.opened).length;
}

export function invGet(inv: Inventory, id: SpecialId) {
  const cat = classifySpecial(id);
  return Number(inv.categories?.[cat]?.[id] ?? 0);
}

export function invAdd(inv: Inventory, id: SpecialId, amount: number) {
  const cat = classifySpecial(id);
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return;
  inv.categories[cat][id] = Math.max(0, (inv.categories[cat][id] ?? 0) + n);
}

export function invConsume(inv: Inventory, id: SpecialId) {
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
