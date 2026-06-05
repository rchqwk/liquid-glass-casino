import { NextResponse } from "next/server";
import { getBlackjackTable, listBlackjackTables } from "../../../lib/db";
import { tickTable } from "../../../lib/blackjackMultiplayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDiscordChannelId(id: string) {
  // Discord "snowflake" ids are typically 17-20 digits.
  return /^[0-9]{16,22}$/.test(id);
}

export async function GET() {
  const metas = await listBlackjackTables();
  const now = Date.now();
  let players = 0;

  for (const m of metas) {
    if (m.public) continue;
    if (!isDiscordChannelId(m.id)) continue;
    const t = await getBlackjackTable(m.id);
    if (!t) continue;
    const state = tickTable(t.state, now);

    const seatsFilled = state.seats.filter(Boolean).length;
    const spectators = state.spectators?.length ?? 0;
    const total = seatsFilled + spectators;
    if (total <= 0) continue;

    players += total;
  }

  return NextResponse.json({ players });
}

