import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { applyPrestige, upsertBlackjackInventory, upsertUserWalletState } from "../../lib/db";
import { defaultInventory } from "../../lib/blackjackInventory";
import { randomHex, sha256Hex } from "../../lib/provablyFair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextPrestigeThreshold(level: number) {
  // 1e9, 1e15, 1e21, ...
  const base = 1_000_000_000;
  const step = 1_000_000;
  return base * Math.pow(step, Math.max(0, level));
}

function defaultColorForPrestige(level: number) {
  // level is the NEW prestige level (1-based)
  if (level === 1) return "brown";
  return null;
}

function zeroWalletState() {
  const serverSeed = randomHex(32);
  const clientSeed = randomHex(16);
  return {
    balance: 0,
    serverSeed,
    serverSeedHash: sha256Hex(serverSeed),
    clientSeed,
    nonce: 0,
    history: [],
    lastRefill5000At: 0,
    lastRefill100At: 0,
    openBets: {},
    updatedAt: Date.now(),
  };
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = String(body?.action ?? "prestige");
  if (action !== "prestige") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const cur = Number((user as any).prestige_level ?? 0);
  const nextLevel = cur + 1;
  const nextColor = defaultColorForPrestige(nextLevel);

  // Apply prestige (server-side) + reset blackjack inventory (powerups/boxes).
  const updatedUser = await applyPrestige({ userId: user.id, nextColor });
  await upsertBlackjackInventory(user.id, defaultInventory());
  const walletState = await upsertUserWalletState(user.id, zeroWalletState());

  return NextResponse.json({
    ok: true,
    user: updatedUser,
    walletState,
    nextThreshold: nextPrestigeThreshold(Number((updatedUser as any)?.prestige_level ?? nextLevel)),
  });
}
