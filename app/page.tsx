import { DiscordRootCallback } from "./components/DiscordRootCallback";
import DiscordMobileAuth from "./components/DiscordRootBootstrapper";
import { redirect } from "next/navigation";

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const code = typeof searchParams?.code === "string" ? searchParams.code : null;
  const state =
    typeof searchParams?.state === "string" ? searchParams.state : null;
  if (code) {
    return <DiscordRootCallback code={code} state={state} />;
  }

  const hasDiscordParams =
    !!searchParams?.frame_id ||
    !!searchParams?.instance_id ||
    !!searchParams?.platform ||
    !!searchParams?.guild_id ||
    !!searchParams?.channel_id;

  if (hasDiscordParams) {
    return <DiscordMobileAuth />;
  }

  redirect("/casino/blackjack-v2");
}
