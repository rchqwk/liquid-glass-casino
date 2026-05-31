import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { normalizeUsername, wipeUserStats } from "../../../lib/db";

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role_level ?? 0) < 2) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  const target = normalizeUsername(body?.username ?? "");
  if (!target) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  await wipeUserStats(target);
  return NextResponse.json({ ok: true, username: target });
}

