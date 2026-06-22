"use client";

import { BlackjackTablePageClient } from "../../blackjack/[id]/page";

export default function BlackjackV2TablePage() {
  return <BlackjackTablePageClient routeBase="/casino/blackjack-v2" lobbyHref="/casino/blackjack-v2" experience="v2" />;
}
