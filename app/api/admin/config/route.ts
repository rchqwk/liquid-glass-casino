import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getConfig, setConfig } from "../../../lib/db";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role_level ?? 0) < 1) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const config = await getConfig();
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role_level ?? 0) < 3) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { diceHouseEdge?: number; slotsPayoutScale?: number }
    | null;

  const next = await setConfig({
    diceHouseEdge: body?.diceHouseEdge,
    slotsPayoutScale: body?.slotsPayoutScale,
  });

  return NextResponse.json({ ok: true, config: next });
}

