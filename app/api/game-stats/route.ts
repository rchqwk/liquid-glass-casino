import { NextResponse } from "next/server";
import { getGameStats } from "../../lib/db";

export async function GET() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await getGameStats(since);
  const list = rows.map((r) => ({
    gameId: String(r.game_id),
    wagerTotal: Number(r.wager_total ?? 0),
    bets: Number(r.bets ?? 0),
  }));
  const totalWagered = list.reduce((a, b) => a + b.wagerTotal, 0);
  return NextResponse.json({ stats: list, totalWagered, windowHours: 24 });
}
