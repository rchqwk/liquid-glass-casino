import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../lib/authServer";
import { blackjackJoinCodeFromTable, normalizeBlackjackJoinCode } from "../../../../lib/blackjackJoinCode";
import { listBlackjackTables } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = normalizeBlackjackJoinCode(searchParams.get("code") ?? "");
  if (!code) return NextResponse.json({ error: "Missing join code" }, { status: 400 });

  const metas = await listBlackjackTables();
  const match = metas.find((m) => blackjackJoinCodeFromTable(m.id, Number(m.created_at ?? 0) || 0) === code);
  if (!match) return NextResponse.json({ error: "Join code not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    tableId: match.id,
    code,
    name: match.name,
    public: !!match.public,
  });
}

