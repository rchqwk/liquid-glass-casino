import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { approveProgressResetRequest, createProgressResetRequest, listPendingProgressResetRequests } from "../../../lib/db";
import { defaultInventory } from "../../../lib/blackjackInventory";
import { syncUserBlackjackInventoryIntoTables } from "../../../lib/blackjackStatePersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number((user as any).role_level ?? 0) < 1) return NextResponse.json({ error: "Moderator only" }, { status: 403 });
  const requests = await listPendingProgressResetRequests();
  return NextResponse.json({ ok: true, requests });
}

export async function POST() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const request = await createProgressResetRequest({ id: user.id, username: user.username });
  return NextResponse.json({ ok: true, request });
}

export async function PATCH(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number((user as any).role_level ?? 0) < 1) return NextResponse.json({ error: "Moderator only" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { requestId?: number } | null;
  const requestId = Number(body?.requestId ?? 0);
  if (!Number.isFinite(requestId) || requestId <= 0) return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  const approved = await approveProgressResetRequest({
    requestId,
    moderatorId: user.id,
    moderatorUsername: user.username,
  });
  if (!approved) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  await syncUserBlackjackInventoryIntoTables(Number((approved as any).user_id ?? 0), defaultInventory());
  return NextResponse.json({ ok: true, request: approved });
}

