import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { addAnnouncement, recordGameStat, recordLeaderboard, updateBalanceAndCheckDoubled } from "../../../lib/db";

function normalizeGameId(raw: string) {
  const g = String(raw ?? "").toLowerCase();
  if (g.includes("10x10") || g.includes("break bonanza")) return "slots-10x10";
  if (g.includes("5x5") || g.includes("fruit bowl")) return "slots-5x5";
  if (g.includes("emoji hold") || g.includes("hold and win") || g.includes("slots")) return "slots";
  if (g.includes("blackjack")) return "blackjack";
  if (g.includes("roulette")) return "roulette";
  if (g.includes("dice")) return "dice";
  if (g.includes("poker")) return "poker";
  return g.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "unknown";
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { profit?: number; wager?: number; baseWager?: number; game?: string; balance?: number }
    | null;

  const profit = Number(body?.profit ?? 0);
  const wager = Number(body?.wager ?? 0);
  const baseWagerRaw = Number(body?.baseWager);
  const denomWager = Number.isFinite(baseWagerRaw) && baseWagerRaw > 0 ? baseWagerRaw : wager;
  const game = String(body?.game ?? "").slice(0, 32);
  const balance = Number(body?.balance);

  if (!Number.isFinite(profit) || !Number.isFinite(wager) || wager < 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await recordLeaderboard(user.id, profit, wager);
  await recordGameStat(normalizeGameId(game), wager);

  // Broadcast big wins (return multiplier, including stake)
  if (denomWager > 0) {
    // For bonus-buy style games, denomWager can be the base bet (not the buy cost).
    const returnMult = (wager + profit) / denomWager;
    if (Number.isFinite(returnMult) && returnMult >= 10) {
      const rounded = returnMult >= 100 ? Math.round(returnMult) : Math.round(returnMult * 10) / 10;
      await addAnnouncement(`${user.username} has just won ${rounded}x their bet`);
    }
  }

  // Broadcast "doubled balance in last 10 mins" if client sent balanceAfter.
  if (Number.isFinite(balance)) {
    const mult = await updateBalanceAndCheckDoubled(user.id, balance);
    if (mult >= 2) {
      if (mult === 2) await addAnnouncement(`${user.username} has doubled their balance in the last 10 mins`);
      else if (mult === 3) await addAnnouncement(`${user.username} has tripled their balance in the last 10 mins`);
      else if (mult === 4) await addAnnouncement(`${user.username} has quadrupled their balance in the last 10 mins`);
      else if (mult === 5) await addAnnouncement(`${user.username} has quintupled their balance in the last 10 mins`);
      else if (mult === 6) await addAnnouncement(`${user.username} has sextupled their balance in the last 10 mins`);
      else await addAnnouncement(`${user.username} has increased their balance ${mult}x in the last 10 mins`);
    }
  }

  return NextResponse.json({ ok: true, game });
}
