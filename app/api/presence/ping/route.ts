import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { getPresenceCounts, touchUserLastSeen } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await touchUserLastSeen(user.id);
  const counts = await getPresenceCounts();
  return NextResponse.json({ ok: true, online: counts.online, active1h: counts.active1h });
}

