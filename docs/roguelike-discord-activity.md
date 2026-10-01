# Roguelike Blackjack in Discord

Opening Roguelike Blackjack inside the existing Discord Activity selects multiplayer and joins a co-op room for the voice-call channel. Friends who open or join the same Activity follow into the active roguelike room, including people already on the regular blackjack screen. Each person must join/open the Activity; the app does not launch it for other call members.

The shared Embedded App SDK and existing Discord sign-in flow are reused. Account identity and display names come from the server session. A room holds four players; a fifth sees a full-room message and can retry. Returning players keep their seat. Mid-hand arrivals wait for the next deal. Heartbeats run every 20 seconds, with a two-minute disconnect grace period. Expired seats are reclaimed, host ownership transfers, and an abandoned call restarts with a fresh lobby.

Rich Presence shows Roguelike Blackjack, co-op, the current phase/round, and party size. Invite friends opens Discord's native Activity invite dialog. When browser pairing is necessary because mobile RPC is unavailable, players still match to their call; Rich Presence and native invites require working Discord RPC.

Room writes use compare-and-set in PostgreSQL and the local store so simultaneous joins, actions, heartbeats and leaves cannot silently overwrite each other. Existing seat authorization remains enforced. Only the host can deal, advance or reset the run. Manual web room-code games continue to work.

## Automated checks

Run `npm run test:roguelike-discord`, `npm run test:discord-auth`, `npm run test:casino-ui`, TypeScript and the production build. Optional HTTP/client-effect checks require `CASINO_TEST_BASE` pointing to the isolated localhost preview with a disposable store and no production database variables. Discord RPC is mocked in automated tests.

## Live Discord acceptance checklist

- [ ] Open the Activity in a call with two distinct Discord accounts. Open Roguelike Blackjack; both should reach one room without typing names/codes.
- [ ] Confirm Rich Presence displays the game and 2/4 players. Invite a third through Invite friends; they should join the same room.
- [ ] Deal as host. A late arrival should wait until the next round, then receive cards.
- [ ] Reopen/reconnect one client; verify one seat per account. Close a client for over two minutes; verify its seat is reclaimed and the host can continue.
- [ ] Fill four seats; verify the fifth receives the full-room message. Open a separate call; verify it receives a different room.
- [ ] Test Discord desktop and mobile. If mobile requires browser pairing, confirm it returns to roguelike in the same call.

Automated checks and browser rendering are verified independently. The two-account real Discord call and Discord-client Rich Presence display require the live acceptance pass above.
