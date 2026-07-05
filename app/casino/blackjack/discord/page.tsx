// Discord OAuth callback handler.
// Discord's Developer Portal redirect_uri is configured to this path.
// This page handles both:
//   1. OAuth callback — Discord sends the user back here with ?code=&state=
//   2. Direct Activity load (fallback) — frame_id etc from Discord iframe
//
// The actual auth logic lives in DiscordMobileAuth. This page is just a
// thin shell that routes to it.

import DiscordMobileAuth from "../../../components/DiscordRootBootstrapper";

export default function DiscordAuthEntryPage() {
  return <DiscordMobileAuth />;
}
