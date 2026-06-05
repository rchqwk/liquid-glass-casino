import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { updateUserCustomizations } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLOR_UNLOCKS: Array<{ color: string; minPrestige: number }> = [
  { color: "brown", minPrestige: 1 },
  { color: "red", minPrestige: 2 },
  { color: "orange", minPrestige: 3 },
  { color: "yellow", minPrestige: 4 },
  { color: "green", minPrestige: 5 },
  { color: "teal", minPrestige: 6 },
  { color: "blue", minPrestige: 7 },
  { color: "indigo", minPrestige: 8 },
  { color: "violet", minPrestige: 9 },
  { color: "pink", minPrestige: 10 },
  // Exotic tiers (every +5 prestige after 10)
  { color: "cyan", minPrestige: 15 },
  { color: "lime", minPrestige: 20 },
];

const ALLOWED_COLORS = new Set(["default", ...COLOR_UNLOCKS.map((x) => x.color)]);

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    prestige_level: Number((user as any).prestige_level ?? 0),
    prestige_points: Number((user as any).prestige_points ?? 0),
    name_color: ((user as any).name_color ?? null) as any,
  });
}

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { claimPrestige1?: boolean; name_color?: string | null }
    | null;

  const curPrestige = Number((user as any).prestige_level ?? 0);

  // (legacy) claimPrestige1 is deprecated; use /api/prestige.

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "name_color")) {
    const nextColorRaw = String(body?.name_color ?? "default");
    const nextColor = nextColorRaw === "default" ? null : nextColorRaw;
    if (nextColor && !ALLOWED_COLORS.has(nextColor)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (nextColor) {
      const rule = COLOR_UNLOCKS.find((r) => r.color === nextColor);
      const min = rule?.minPrestige ?? 999999;
      if (curPrestige < min) return NextResponse.json({ error: "Locked" }, { status: 403 });
    }
    const next = await updateUserCustomizations({ userId: user.id, name_color: nextColor });
    return NextResponse.json({ ok: true, user: next });
  }

  return NextResponse.json({ ok: true });
}
