# Casino UI

The casino uses a scoped navy/emerald design system in `app/casino/casino.css`. `CasinoShell` selects browse/table widths, while `Topbar` keeps navigation, account access, and balance visible. Optional token controls use an explicit disclosure. The existing cartoon skin and compact table preference remain available; new users start with the standard responsive layout.

The Blackjack lobby is shared by classic/V2 entry points. Guests can browse public room metadata; joining, creating, purchases, account claims, and private inventory remain authenticated. Anonymous lobby discovery cannot tick or persist game state. Failure and stale states are distinct from an empty lobby.

`BlackjackResponsiveTable` renders the player's seat first and displays split hands independently. It consumes the existing authoritative state, without changing game rules. Decorations retain the existing drag/pickup actions. `CasinoDialog` uses native dialog focus trapping, Escape handling, and focus restoration for inventory, sign-in, table chat, host options, collectibles, and mystery boxes. Leaving requires confirmation.

On desktop (above 900px), your hand and the dealer share the front row, with a bounded, keyboard-focusable player region beneath. Standard round controls occupy a sticky 320px sidebar, including on 1024px laptops. Mobile keeps the player's hand first and the full player list in normal page flow. The main Double/Split controls use the guarded server wallet reservation, await its nonce, and cancel rejected table actions through the existing wallet flow.

The transport hook shares identical in-flight requests, preserves uncertain request IDs in session storage across refreshes, scopes them to the actor/table/payload digest, and treats incomplete acknowledgements as unconfirmed. Only request IDs are persisted; credentials and action payloads are not stored. Keep the server ownership, receipts, and table/inventory compare-and-set protections intact.

## Verification

- `npm run test:casino-ui`: isolated transport tests for duplicate clicks, lost responses, incomplete acknowledgements, refresh replay, and actor scoping.
- Set `CASINO_TEST_BASE` only to an isolated test server to additionally run account/table/inventory HTTP checks. These checks create disposable profiles and rooms. Never point them at production.
- `npx tsc --noEmit` and `npm run build` verify the TypeScript/production bundle.
- `/casino/ui-preview` renders synthetic ten-seat, split, long-hand, empty, and betting states in development. It returns 404 in production and performs no game actions.
- Verify phone widths 320/360/390, tablet 768, desktop 1024/1440, compact Discord frames, keyboard dialogs, and navigation. Retest live Discord handoff and authenticated rounds with appropriate test accounts before claiming those platform checks complete.

Mobile zoom is enabled. AdSense runs after hydration; the server-rendered publisher meta tag preserves the supported ownership-verification method described in [Google's documentation](https://support.google.com/adsense/answer/12169212?hl=en).

## Discord sign-in recovery

`discordClient` keeps one Embedded App SDK per document and coalesces single-use OAuth code exchanges across callback remounts. AuthProvider routes unauthenticated Activities to the entry page, which owns authorization. Embedded navigation uses the Next router instead of reloading the Activity iframe. SDK handshake/authorization and HTTP token exchange waits are bounded; desktop and mobile can recover through browser pairing. Pairing stops on expiry. OAuth fallback requires a user click and never redirects automatically into a sign-in loop.

The root callback awaits Next.js search parameters, supports browser-pairing completion, and preserves the registered redirect URI across the apex/www redirect. Return paths cannot point to another origin or re-enter the auth route. Run `npm run test:discord-auth`; verify a fresh real Discord Activity separately before claiming live end-to-end OAuth success.

## Rollback

Keep the previous production deployment URL/ID before promoting the new build. Roll back the deployment if hosted checks fail; do not remove account-ownership or atomic-transaction repairs. Compatible classic/V2 routes and invite handling remain in place.
