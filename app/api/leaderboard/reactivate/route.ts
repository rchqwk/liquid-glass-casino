import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { setLeaderboardActive } from "../../../lib/db";

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { keep?: boolean } | null;
  const keep = !!body?.keep;

  // If keep=false -> reset stats; either way make active again.
  await setLeaderboardActive(user.id, true, !keep);
  return NextResponse.json({ ok: true, kept: keep });
}

