import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../../lib/db";
import { ensureInventory, safePublicStateForUser, tickTable } from "../../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shortId() {
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function isValidPngUrl(url: string) {
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith(".png");
  } catch {
    return false;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as any;
  const action = String(body?.action ?? "");

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);
  state.lastActivityAt = now;
  state.decorations = Array.isArray((state as any).decorations) ? ((state as any).decorations as any[]) : [];

  const seatIdx = state.seats.findIndex((p) => p?.userId === user.id);
  if (seatIdx < 0) return NextResponse.json({ error: "You are not seated at this table." }, { status: 403 });
  const seat = state.seats[seatIdx]!;
  seat.inventory = ensureInventory(seat.inventory);
  seat.inventory.collectibles = seat.inventory.collectibles ?? { owned: {}, figurines: [] };
  seat.inventory.collectibles.placed = Array.isArray(seat.inventory.collectibles.placed)
    ? seat.inventory.collectibles.placed
    : [];
  // Enforce a max of 4 placed items per player.
  const maxPlaced = 4;

  if (action === "create_figurine") {
    const cost = 20;
    seat.inventory.bonusPoints = Math.max(0, Math.floor(Number((seat.inventory as any).bonusPoints ?? 0) || 0));
    if ((seat.inventory as any).bonusPoints < cost) {
      return NextResponse.json({ error: `Not enough bonus points. Custom figurine costs ${cost}.` }, { status: 400 });
    }
    const imageUrl = String(body?.imageUrl ?? "").trim();
    if (!isValidPngUrl(imageUrl)) return NextResponse.json({ error: "Please provide a valid https://... .png URL" }, { status: 400 });
    seat.inventory.collectibles.figurines = Array.isArray(seat.inventory.collectibles.figurines)
      ? seat.inventory.collectibles.figurines
      : [];
    (seat.inventory as any).bonusPoints -= cost;
    seat.inventory.collectibles.figurines.push({ id: shortId(), imageUrl, createdAt: now });
    state.updatedAt = now;
  } else if (action === "place_emoji") {
    const key = String(body?.key ?? "").trim();
    const x = clamp01(Number(body?.x ?? 0.5));
    const y = clamp01(Number(body?.y ?? 0.5));
    if ((seat.inventory.collectibles.placed?.length ?? 0) >= maxPlaced) {
      return NextResponse.json({ error: "Max 4 collectibles can be placed on the table." }, { status: 400 });
    }
    const owned = seat.inventory.collectibles.owned ?? {};
    const cur = Math.floor(Number(owned[key] ?? 0) || 0);
    if (!key || cur <= 0) return NextResponse.json({ error: "Item not owned." }, { status: 400 });
    owned[key] = cur - 1;
    seat.inventory.collectibles.owned = owned;
    const id = shortId();
    state.decorations.push({ id, ownerUserId: user.id, kind: "emoji", key, x, y, createdAt: now });
    seat.inventory.collectibles.placed!.push({ id, kind: "emoji", key, x, y, placedAt: now });
    state.updatedAt = now;
  } else if (action === "place_figurine") {
    const figurineId = String(body?.figurineId ?? "").trim();
    const x = clamp01(Number(body?.x ?? 0.5));
    const y = clamp01(Number(body?.y ?? 0.5));
    if ((seat.inventory.collectibles.placed?.length ?? 0) >= maxPlaced) {
      return NextResponse.json({ error: "Max 4 collectibles can be placed on the table." }, { status: 400 });
    }
    const figs = seat.inventory.collectibles.figurines ?? [];
    const idx = figs.findIndex((f: any) => String(f?.id ?? "") === figurineId);
    if (idx < 0) return NextResponse.json({ error: "Figurine not found." }, { status: 400 });
    const fig = figs[idx]!;
    figs.splice(idx, 1);
    seat.inventory.collectibles.figurines = figs;
    // Reuse figurine id for placed id so it round-trips cleanly.
    const id = figurineId;
    state.decorations.push({
      id,
      ownerUserId: user.id,
      kind: "figurine",
      imageUrl: String(fig.imageUrl ?? ""),
      key: figurineId,
      x,
      y,
      createdAt: now,
    });
    seat.inventory.collectibles.placed!.push({
      id,
      kind: "figurine",
      imageUrl: String(fig.imageUrl ?? ""),
      key: figurineId,
      x,
      y,
      placedAt: now,
    });
    state.updatedAt = now;
  } else if (action === "move") {
    const decorationId = String(body?.decorationId ?? "").trim();
    const x = clamp01(Number(body?.x ?? 0.5));
    const y = clamp01(Number(body?.y ?? 0.5));
    const deco = state.decorations.find((d: any) => String(d?.id ?? "") === decorationId);
    if (!deco) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (Number(deco.ownerUserId ?? 0) !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    deco.x = x;
    deco.y = y;
    const placed = seat.inventory.collectibles.placed ?? [];
    const pi = placed.findIndex((p: any) => String(p?.id ?? "") === decorationId);
    if (pi >= 0) {
      placed[pi] = { ...placed[pi], x, y };
      seat.inventory.collectibles.placed = placed;
    }
    state.updatedAt = now;
  } else if (action === "pickup") {
    const decorationId = String(body?.decorationId ?? "").trim();
    const idx = state.decorations.findIndex((d: any) => String(d?.id ?? "") === decorationId);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const deco: any = state.decorations[idx];
    if (Number(deco.ownerUserId ?? 0) !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    state.decorations.splice(idx, 1);
    // Remove from "placed" list (positions persist only while placed).
    seat.inventory.collectibles.placed = (seat.inventory.collectibles.placed ?? []).filter(
      (p: any) => String(p?.id ?? "") !== decorationId,
    );
    if (deco.kind === "emoji") {
      const key = String(deco.key ?? "");
      const owned = seat.inventory.collectibles.owned ?? {};
      owned[key] = Math.max(0, Math.floor(Number(owned[key] ?? 0) || 0) + 1);
      seat.inventory.collectibles.owned = owned;
    } else if (deco.kind === "figurine") {
      const imageUrl = String(deco.imageUrl ?? "");
      const fid = String(deco.key ?? decorationId ?? shortId());
      if (imageUrl) {
        seat.inventory.collectibles.figurines = seat.inventory.collectibles.figurines ?? [];
        seat.inventory.collectibles.figurines.push({ id: fid, imageUrl, createdAt: now });
      }
    }
    state.updatedAt = now;
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await upsertBlackjackTable({ id: t.id, public: t.public, name: t.name, state, created_at: t.created_at, updated_at: state.updatedAt });
  for (const p of state.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
  for (const ev of state.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
  state.evictedInventories = [];

  return NextResponse.json({ ok: true, state: safePublicStateForUser(state, user.id) });
}
