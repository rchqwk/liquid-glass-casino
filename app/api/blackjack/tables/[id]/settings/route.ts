import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../../../lib/authServer";
import { getBlackjackTable } from "../../../../../lib/db";
import { tickTable } from "../../../../../lib/blackjackMultiplayer";
import { type InventoryCategoryId } from "../../../../../lib/blackjackInventory";
import { saveBlackjackTableState } from "../../../../../lib/blackjackStatePersistence";
import { blackjackTableJsonResponse } from "../../../../../lib/blackjackTableContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  turnDurationMs?: number;
  disabledCategories?: InventoryCategoryId[];
  passwordEnabled?: boolean;
  password?: string;
  afkKickEnabled?: boolean;
};

const ALLOWED_CATS: InventoryCategoryId[] = ["boosts", "saves", "utility", "magic", "dealer", "mythic"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;

  const t = await getBlackjackTable(id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const state = tickTable(t.state, now);

  // Host is always the current player in seat #1 (index 0).
  const hostId = state.seats?.[0]?.userId ?? null;
  if (hostId !== user.id) return NextResponse.json({ error: "Host only." }, { status: 403 });

  const td = Number(body?.turnDurationMs ?? state.turnDurationMs ?? 30_000);
  state.turnDurationMs = td === 60_000 ? 60_000 : 30_000;

  const cats = Array.isArray(body?.disabledCategories) ? body!.disabledCategories : state.disabledCategories ?? [];
  state.disabledCategories = Array.from(new Set(cats.filter((c) => (ALLOWED_CATS as string[]).includes(String(c))) as InventoryCategoryId[]));

  state.afkKickEnabled = typeof body?.afkKickEnabled === "boolean" ? body!.afkKickEnabled : !!state.afkKickEnabled;

  state.passwordEnabled = !!body?.passwordEnabled;
  if (state.passwordEnabled) {
    const pw = String(body?.password ?? "").trim();
    if (!pw) return NextResponse.json({ error: "Password cannot be empty." }, { status: 400 });
    state.password = pw;
  } else {
    state.password = null;
  }

  state.lastActivityAt = now;
  state.updatedAt = now;

  await saveBlackjackTableState(t, state);

  return blackjackTableJsonResponse(state, user.id);
}
