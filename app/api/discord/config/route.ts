import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The application id is public. Served at runtime so a build without NEXT_PUBLIC_* still signs in,
// matching the /api/config route the other Activities expose.
export async function GET() {
  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ||
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ||
    process.env.DISCORD_CLIENT_ID ||
    "";
  return NextResponse.json({ clientId });
}
