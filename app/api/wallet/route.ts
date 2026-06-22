import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { getUserWalletState, upsertUserWalletState } from "../../lib/db";
import { randomHex, sha256Hex } from "../../lib/provablyFair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function freshWalletState() {
  const serverSeed = randomHex(32);
  const clientSeed = randomHex(16);
  return {
    balance: 1000,
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

async function loadWallet(userId: number) {
  return (await getUserWalletState(userId)) ?? freshWalletState();
}

function resetWalletState(balance = 1000) {
  const serverSeed = randomHex(32);
  const clientSeed = randomHex(16);
  return {
    balance: clampMoney(Math.max(0, balance)),
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

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await loadWallet(user.id);
  return NextResponse.json({ state });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        action?: string;
        state?: any;
        game?: string;
        wager?: number;
        baseWager?: number;
        nonce?: number;
        multiplier?: number;
        outcome?: string;
        delta?: number;
      }
    | null;
  const action = String(body?.action ?? "sync");
  if (action === "sync") {
    if (!body?.state || typeof body.state !== "object") {
      return NextResponse.json({ error: "Missing wallet state" }, { status: 400 });
    }
    const saved = await upsertUserWalletState(user.id, body.state);
    return NextResponse.json({ ok: true, state: saved });
  }

  const state = await loadWallet(user.id);

  if (action === "reserve_bet") {
    const game = String(body?.game ?? "").slice(0, 48);
    const wager = clampMoney(Number(body?.wager ?? 0) || 0);
    const baseWager = Number(body?.baseWager ?? 0);
    if (!game) return NextResponse.json({ error: "Missing game" }, { status: 400 });
    if (!(wager > 0)) return NextResponse.json({ error: "Invalid wager" }, { status: 400 });
    if (state.balance < wager) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

    const nonce = Math.max(0, Math.floor(Number(state.nonce ?? 0) || 0));
    const openBets: Record<number, any> = { ...((state.openBets ?? {}) as Record<number, any>) };
    openBets[nonce] = {
      game,
      wager,
      ts: Date.now(),
      serverSeed: state.serverSeed,
      clientSeed: state.clientSeed,
      baseWager: Number.isFinite(baseWager) && baseWager > 0 ? clampMoney(baseWager) : undefined,
    };
    const next = {
      ...state,
      balance: clampMoney(state.balance - wager),
      nonce: nonce + 1,
      openBets,
      updatedAt: Date.now(),
    };
    const saved = await upsertUserWalletState(user.id, next);
    return NextResponse.json({ ok: true, nonce, state: saved });
  }

  if (action === "cancel_bet" || action === "settle_bet") {
    const nonce = Math.max(0, Math.floor(Number(body?.nonce ?? -1)));
    const openBets = (state.openBets ?? {}) as Record<number, any>;
    const open = openBets[nonce];
    if (!open) return NextResponse.json({ error: "Bet not found" }, { status: 400 });
    const multiplier =
      action === "cancel_bet" ? 1 : Math.max(0, Number(body?.multiplier ?? 0) || 0);
    const outcome = String(body?.outcome ?? (action === "cancel_bet" ? "Bet canceled" : "Settled")).slice(0, 240);
    const payout = clampMoney(open.wager * multiplier);
    const profit = clampMoney(payout - open.wager);
    const nextOpenBets: Record<number, any> = { ...((state.openBets ?? {}) as Record<number, any>) };
    delete nextOpenBets[nonce];
    const history = [
      {
        ts: Date.now(),
        game: open.game,
        wager: open.wager,
        multiplier,
        profit,
        outcome,
      },
      ...(state.history ?? []),
    ].slice(0, 20);
    const next = {
      ...state,
      balance: clampMoney(state.balance + payout),
      openBets: nextOpenBets,
      history,
      updatedAt: Date.now(),
    };
    const saved = await upsertUserWalletState(user.id, next);
    return NextResponse.json({ ok: true, state: saved, profit, balanceAfter: saved?.balance ?? next.balance });
  }

  if (action === "adjust_balance") {
    const delta = clampMoney(Number(body?.delta ?? 0) || 0);
    const outcome = String(body?.outcome ?? "Balance adjusted").slice(0, 240);
    if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: "Invalid delta" }, { status: 400 });
    if (delta < 0 && state.balance < Math.abs(delta)) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }
    const next = {
      ...state,
      balance: clampMoney(state.balance + delta),
      history: [
        {
          ts: Date.now(),
          game: String(body?.game ?? "Wallet").slice(0, 48),
          wager: Math.abs(delta),
          multiplier: delta >= 0 ? 1 : 0,
          profit: delta,
          outcome,
        },
        ...(state.history ?? []),
      ].slice(0, 20),
      updatedAt: Date.now(),
    };
    const saved = await upsertUserWalletState(user.id, next);
    return NextResponse.json({ ok: true, state: saved, balanceAfter: saved?.balance ?? next.balance });
  }

  if (action === "claim_refill") {
    const kind = String(body?.outcome ?? body?.game ?? body?.state?.kind ?? body?.delta ?? body?.action ?? "").trim();
    const refillKind = String((body as any)?.kind ?? "").trim();
    const actualKind = refillKind || kind;
    const bypassCooldown = !!(body as any)?.bypassCooldown;
    const amount = clampMoney(Number(body?.delta ?? body?.wager ?? body?.baseWager ?? 0) || 0);
    const now = Date.now();
    const isRefill5000 = actualKind === "refill5000";
    const isRefill100 = actualKind === "refill100";
    if (!isRefill5000 && !isRefill100) {
      return NextResponse.json({ error: "Invalid refill kind" }, { status: 400 });
    }
    if (!(amount > 0)) return NextResponse.json({ error: "Invalid refill amount" }, { status: 400 });
    if (isRefill5000 && !bypassCooldown) {
      const nextAt = Number(state.lastRefill5000At ?? 0) + 15 * 60 * 1000;
      if (now < nextAt) return NextResponse.json({ error: "Refill is on cooldown.", nextAvailableAt: nextAt }, { status: 400 });
    }
    if (isRefill100 && !bypassCooldown) {
      const nextAt = Number(state.lastRefill100At ?? 0) + 60 * 1000;
      if (now < nextAt) return NextResponse.json({ error: "Refill is on cooldown.", nextAvailableAt: nextAt }, { status: 400 });
    }
    const next = {
      ...state,
      balance: clampMoney(state.balance + amount),
      lastRefill5000At: isRefill5000 && !bypassCooldown ? now : Number(state.lastRefill5000At ?? 0),
      lastRefill100At: isRefill100 && !bypassCooldown ? now : Number(state.lastRefill100At ?? 0),
      history: [
        {
          ts: now,
          game: "Wallet Refill",
          wager: amount,
          multiplier: 1,
          profit: amount,
          outcome: isRefill5000 ? "Large refill claimed" : "Quick refill claimed",
        },
        ...(state.history ?? []),
      ].slice(0, 20),
      updatedAt: now,
    };
    const saved = await upsertUserWalletState(user.id, next);
    return NextResponse.json({
      ok: true,
      state: saved,
      balanceAfter: saved?.balance ?? next.balance,
      nextAvailableAt: isRefill5000 ? Number(saved?.lastRefill5000At ?? next.lastRefill5000At) + 15 * 60 * 1000 : Number(saved?.lastRefill100At ?? next.lastRefill100At) + 60 * 1000,
    });
  }

  if (action === "reset_wallet") {
    const balance = clampMoney(Number((body as any)?.balance ?? 1000) || 0);
    const saved = await upsertUserWalletState(user.id, resetWalletState(balance));
    return NextResponse.json({ ok: true, state: saved, balanceAfter: saved?.balance ?? balance });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
