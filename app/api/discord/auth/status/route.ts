import { NextResponse } from "next/server";
import { getDiscordAuthTransactionById, getDiscordAuthTransactionByPairingCode } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txId = String(searchParams.get("tx") ?? "").trim();
  const pairingCode = String(searchParams.get("code") ?? "").trim();

  const tx = txId
    ? await getDiscordAuthTransactionById(txId)
    : pairingCode
      ? await getDiscordAuthTransactionByPairingCode(pairingCode)
      : null;

  if (!tx) return NextResponse.json({ error: "Auth transaction not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    transaction: tx,
  });
}

