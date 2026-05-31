import { NextResponse } from "next/server";
import { getAnnouncements } from "../../lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? "0");
  const rows = await getAnnouncements(Number.isFinite(after) ? after : 0, 20);
  return NextResponse.json({ announcements: rows });
}

