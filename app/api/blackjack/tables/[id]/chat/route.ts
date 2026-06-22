import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable } from "../../../../../lib/db";
import { applyChatMessage, tickTable } from "../../../../../lib/blackjackMultiplayer";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../../../lib/blackjackTableContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { text?: string } | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const base = tickTable(t.state, now);
  const res = applyChatMessage(
    base,
    user.id,
    {
      text: String(body?.text ?? ""),
      username: user.username,
      prestigeLevel: Number((user as any)?.prestige_level ?? 0),
      nameColor: ((user as any)?.name_color ?? null) as string | null,
    },
    now,
  );

  await saveBlackjackTableState(t, res.state);

  if (res.error) {
    return blackjackTableJsonResponse(res.state, user.id, { status: 400, error: res.error });
  }
  return blackjackTableJsonResponse(res.state, user.id);
}
