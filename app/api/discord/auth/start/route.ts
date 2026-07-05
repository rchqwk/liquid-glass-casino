import { NextResponse } from "next/server";
import { createDiscordAuthTransaction } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        kind?: "embedded" | "browser_pairing";
        source?: "activity" | "web";
        platform?: "desktop" | "mobile" | "unknown";
        channelId?: string | null;
        guildId?: string | null;
        returnPath?: string | null;
      }
    | null;

  const tx = await createDiscordAuthTransaction({
    kind: body?.kind === "browser_pairing" ? "browser_pairing" : "embedded",
    source: body?.source === "web" ? "web" : "activity",
    platform:
      body?.platform === "desktop" || body?.platform === "mobile" || body?.platform === "unknown"
        ? body.platform
        : "unknown",
    channelId: body?.channelId ?? null,
    guildId: body?.guildId ?? null,
    returnPath: body?.returnPath ?? null,
  });

  return NextResponse.json({ ok: true, transaction: tx });
}

