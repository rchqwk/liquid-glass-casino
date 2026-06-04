import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { updateUserCustomizations } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COLORS = new Set(["brown", "default"]);

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    prestige_level: Number((user as any).prestige_level ?? 0),
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

  // Claim prestige 1 (client is responsible for checking balance threshold in this prototype).
  if (body?.claimPrestige1) {
    const payload: { userId: number; prestige_level: number; name_color?: string | null } = {
      userId: user.id,
      prestige_level: 1,
    };
    // Default brown if none set yet.
    if (!(user as any).name_color) payload.name_color = "brown";
    const next = await updateUserCustomizations(payload);
    return NextResponse.json({ ok: true, user: next });
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "name_color")) {
    const nextColorRaw = String(body?.name_color ?? "default");
    const nextColor = nextColorRaw === "default" ? null : nextColorRaw;
    if (nextColor && !ALLOWED_COLORS.has(nextColor)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (nextColor === "brown" && curPrestige < 1) {
      return NextResponse.json({ error: "Locked" }, { status: 403 });
    }
    const next = await updateUserCustomizations({ userId: user.id, name_color: nextColor });
    return NextResponse.json({ ok: true, user: next });
  }

  return NextResponse.json({ ok: true });
}
