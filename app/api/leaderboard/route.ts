import { NextResponse } from "next/server";
import { getLeaderboardRows } from "../../lib/db";

export async function GET() {
  const rows = await getLeaderboardRows(50);

  return NextResponse.json({ rows });
}
