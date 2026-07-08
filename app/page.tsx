import { DiscordRootCallback } from "./components/DiscordRootCallback";
import { redirect } from "next/navigation";

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // If Discord OAuth redirected back to the site root (rchqwk.com),
  // complete the login client-side from here.
  const code = typeof searchParams?.code === "string" ? searchParams.code : null;
  const state =
    typeof searchParams?.state === "string" ? searchParams.state : null;
  if (code) {
    return <DiscordRootCallback code={code} state={state} />;
  }

  // If Discord launches the Activity at the site root (recommended), it will append
  // Embedded App query params like `frame_id`. Detect that and forward into the
  // casino experience while preserving query params.
  const hasDiscordParams =
    !!searchParams?.frame_id ||
    !!searchParams?.instance_id ||
    !!searchParams?.platform ||
    !!searchParams?.guild_id ||
    !!searchParams?.channel_id;
  if (hasDiscordParams) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (Array.isArray(v)) v.forEach((vv) => vv != null && sp.append(k, String(vv)));
      else if (v != null) sp.set(k, String(v));
    }
    redirect(`/casino/blackjack-v2${sp.toString() ? `?${sp.toString()}` : ""}`);
  }
  redirect("/casino/blackjack-v2");
}
