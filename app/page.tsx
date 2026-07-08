import { DiscordRootCallback } from "./components/DiscordRootCallback";
import { redirect } from "next/navigation";

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // If Discord OAuth redirected back to the site root (rchqwk.com),
  // complete the login from here.
  const code = typeof searchParams?.code === "string" ? searchParams.code : null;
  const state = typeof searchParams?.state === "string" ? searchParams.state : null;
  if (code) {
    return <DiscordRootCallback code={code} state={state} />;
  }

  redirect("/casino/blackjack-v2");
}
