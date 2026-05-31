import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { normalizeUsername, setUserRoleByUsername } from "../../../lib/db";

const MASTER_USERNAME = normalizeUsername(process.env.LGC_MASTER_USERNAME ?? "master");

export async function POST(req: Request) {
  const user = await getAuthedUserAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only master can change roles
  if (normalizeUsername(user.username) !== MASTER_USERNAME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: string; role_level?: number }
    | null;

  const target = normalizeUsername(body?.username ?? "");
  const level = Math.max(0, Math.min(3, Math.floor(Number(body?.role_level ?? 0))));

  if (!target) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  if (!/^[a-z0-9_]+$/.test(target)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  if (target === MASTER_USERNAME && level !== 3) {
    return NextResponse.json({ error: "Master must stay level 3" }, { status: 400 });
  }

  await setUserRoleByUsername(target, level);
  return NextResponse.json({ ok: true, username: target, role_level: level });
}

