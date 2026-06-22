import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { getUserWalletState, upsertUserWalletState } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getUserWalletState(user.id);
  return NextResponse.json({ state });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: string; state?: any } | null;
  const action = String(body?.action ?? "sync");
  if (action !== "sync") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (!body?.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Missing wallet state" }, { status: 400 });
  }

  const saved = await upsertUserWalletState(user.id, body.state);
  return NextResponse.json({ ok: true, state: saved });
}
