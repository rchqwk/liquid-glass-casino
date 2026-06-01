import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import { getBlackjackTable, listBlackjackTables, upsertBlackjackInventory, upsertBlackjackTable } from "../../../../lib/db";
import { safePublicStateForUser, tickTable } from "../../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbSource() {
  if (process.env.POSTGRES_URL) return "POSTGRES_URL";
  if (process.env.NEON_DATABASE_URL) return "NEON_DATABASE_URL";
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  return "file";
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const t = await getBlackjackTable(id);
  if (!t) {
    const metas = await listBlackjackTables();
    return NextResponse.json(
      {
        error: "Not found",
        dbSource: dbSource(),
        knownTables: metas.slice(0, 5).map((m) => m.id),
      },
      { status: 404 },
    );
  }

  const now = Date.now();
  const next = tickTable(t.state, now);
  if (next.updatedAt !== t.updated_at) {
    await upsertBlackjackTable({
      id: t.id,
      public: t.public,
      name: t.name,
      state: next,
      created_at: t.created_at,
      updated_at: next.updatedAt,
    });
    for (const p of next.seats) if (p) await upsertBlackjackInventory(p.userId, p.inventory);
    for (const ev of next.evictedInventories ?? []) await upsertBlackjackInventory(ev.userId, ev.inventory);
    next.evictedInventories = [];
  }

  return NextResponse.json({ state: safePublicStateForUser(next, user.id), dbSource: dbSource() });
}
