import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { recordLeaderboard } from "../../../lib/db";

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { profit?: number; wager?: number; game?: string }
    | null;

  const profit = Number(body?.profit ?? 0);
  const wager = Number(body?.wager ?? 0);
  const game = String(body?.game ?? "").slice(0, 32);

  if (!Number.isFinite(profit) || !Number.isFinite(wager) || wager < 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await recordLeaderboard(user.id, profit, wager);

  return NextResponse.json({ ok: true, game });
}
