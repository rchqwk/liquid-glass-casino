import { NextResponse } from "next/server";
import { getGameStats } from "../../lib/db";

export async function GET() {
  const rows = await getGameStats();
  const list = rows.map((r) => ({
    gameId: String(r.game_id),
    wagerTotal: Number(r.wager_total ?? 0),
    bets: Number(r.bets ?? 0),
  }));
  const totalWagered = list.reduce((a, b) => a + b.wagerTotal, 0);
  return NextResponse.json({ stats: list, totalWagered });
}

