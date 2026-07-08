"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DiscordAuthEntryPage() {
  const router = useRouter();
  useEffect(() => {
    // Discord Activity auth has been disabled.
    // Users should use the temporary username path instead.
    // Browser pairing at /discord/mobile is still available as a manual option.
    router.replace("/casino/blackjack-v2");
  }, [router]);
  return null;
}
