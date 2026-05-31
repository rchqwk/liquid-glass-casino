import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { resetLeaderboard } from "../../../lib/db";

export async function POST() {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role_level ?? 0) < 2) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await resetLeaderboard();
  return NextResponse.json({ ok: true });
}

