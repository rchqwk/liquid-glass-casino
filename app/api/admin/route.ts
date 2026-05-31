import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../lib/authServer";
import { getConfig } from "../../lib/db";

export async function GET() {
  const user = await getAuthedUserAsync();
  if (!user || (user.role_level ?? 0) < 1) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await getConfig();
  return NextResponse.json({ user, config });
}

