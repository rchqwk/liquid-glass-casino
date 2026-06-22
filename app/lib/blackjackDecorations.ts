"server-only";

import type { TableState } from "./blackjackMultiplayer";

type PlacedCollectible = {
  id: string;
  kind: "emoji" | "figurine";
  key?: string;
  imageUrl?: string;
  x: number;
  y: number;
  placedAt: number;
};

export function ensureBlackjackDecorations(state: TableState) {
  (state as any).decorations = Array.isArray((state as any).decorations) ? ((state as any).decorations as any[]) : [];
  return (state as any).decorations as any[];
}

export function removeUserBlackjackDecorations(state: TableState, userId: number) {
  const decorations = ensureBlackjackDecorations(state);
  (state as any).decorations = decorations.filter((d: any) => Number(d?.ownerUserId ?? 0) !== Number(userId));
  return (state as any).decorations as any[];
}

export function syncPlacedCollectiblesToBlackjackDecorations(
  state: TableState,
  userId: number,
  placedRaw: unknown,
  now: number,
) {
  removeUserBlackjackDecorations(state, userId);
  const decorations = ensureBlackjackDecorations(state);
  const placed = Array.isArray(placedRaw) ? (placedRaw as any[]).slice(0, 4) : [];
  for (const p of placed) {
    decorations.push({
      id: String(p?.id ?? ""),
      ownerUserId: userId,
      kind: String(p?.kind ?? "") === "figurine" ? "figurine" : "emoji",
      key: p?.key != null ? String(p.key) : undefined,
      imageUrl: p?.imageUrl != null ? String(p.imageUrl) : undefined,
      x: Number(p?.x ?? 0.5),
      y: Number(p?.y ?? 0.5),
      createdAt: Number(p?.placedAt ?? now) || now,
    });
  }
  return decorations;
}

export function syncOwnedDecorationsIntoPlacedCollectibles(
  state: TableState,
  userId: number,
  placedRaw: unknown,
  now: number,
) {
  const decorations = ensureBlackjackDecorations(state);
  const placed = Array.isArray(placedRaw) ? (placedRaw as PlacedCollectible[]) : [];
  const existingIds = new Set(placed.map((x) => String(x?.id ?? "")));
  const mine = decorations.filter((d: any) => Number(d?.ownerUserId ?? 0) === Number(userId));
  for (const d of mine) {
    const id = String(d?.id ?? "");
    if (!id || existingIds.has(id)) continue;
    const kind = String(d?.kind ?? "emoji") === "figurine" ? "figurine" : "emoji";
    const x = Number(d?.x ?? 0.5);
    const y = Number(d?.y ?? 0.5);
    placed.push({
      id,
      kind,
      key: d?.key != null ? String(d.key) : undefined,
      imageUrl: d?.imageUrl != null ? String(d.imageUrl) : undefined,
      x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5,
      y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5,
      placedAt: Number(d?.createdAt ?? now) || now,
    });
    existingIds.add(id);
  }
  return placed.slice(0, 4);
}
