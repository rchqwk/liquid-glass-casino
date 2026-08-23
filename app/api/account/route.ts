import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { getUserXp } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ user: null });
  const xp = await getUserXp(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role_level: user.role_level,
      prestige_level: Number((user as any).prestige_level ?? 0),
      prestige_points: Number((user as any).prestige_points ?? 0),
      name_color: ((user as any).name_color ?? null) as string | null,
      xp,
    },
  });
}
