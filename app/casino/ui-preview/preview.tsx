"use client";

import { useRef, useState } from "react";
import { BlackjackResponsiveTable } from "../blackjack/BlackjackResponsiveTable";
import { BlackjackTurnActionBar, BlackjackV2StatusStrip } from "../blackjack/blackjackTableShell";
import type { BJState, Seat } from "../blackjack/blackjackTableTypes";

function fixture(mode: string): BJState {
  const seat = (index: number): Seat => ({ userId: index + 1, username: index === 0 ? "Your preview seat" : `Player ${index + 1}`, missedRounds: 0, bet: 25, cards: [index, index + 13], bonusPoints: 0, stood: false, busted: false, turnEnded: false, prestigeLevel: index % 3 });
  const seats: Array<Seat | null> = Array.from({ length: 10 }, (_, index) => mode === "full" || index < 2 ? seat(index) : null);
  if (mode === "split" && seats[0]) seats[0].hands = [{ cards: [0, 12], bonusPoints: 0 }, { cards: [13, 24], bonusPoints: 0 }];
  if (mode === "long" && seats[0]) seats[0].cards = [0, 1, 2, 13, 14, 15, 26, 27];
  if (mode === "empty") seats.fill(null);
  return { id: "synthetic-preview", name: "UI preview — no transactions", public: false, phase: mode === "betting" ? "betting" : "player_turns", round: 3, bettingEndsAt: 0, turnEndsAt: 0, dealerWindowEndsAt: 0, seats, spectators: [21, 22], participants: [1, 2], turnIndex: 0, dealer: { cards: [10, -1], bonusPoints: 0 } };
}

export function CasinoUiPreview() {
  const [mode, setMode] = useState("full");
  const ref = useRef<HTMLDivElement>(null);
  const state = fixture(mode);
  return <div className="flex flex-col gap-4">
    <div className="casino-notice"><h1 className="font-semibold">Development UI fixtures</h1><p>Synthetic hands and disabled actions. No account, wager, purchase, or game result is created.</p></div>
    <label className="casino-field">Table fixture<select value={mode} onChange={event => setMode(event.target.value)} className="casino-secondary rounded-xl px-3"><option value="full">Ten occupied seats</option><option value="split">Split hand</option><option value="long">Long hand</option><option value="empty">Empty table</option><option value="betting">Betting phase</option></select></label>
    <BlackjackV2StatusStrip visible phase={state.phase} timerLabel="Turn clock" timerSeconds={24} seatCount={state.seats.filter(Boolean).length} spectatorCount={2} isHost={false} isMyTurn={false} unreadChat={0} onOpenChat={() => {}} onOpenCollectibles={() => {}} onOpenHost={() => {}} onOpenControls={() => {}} />
    <BlackjackTurnActionBar visible={mode !== "empty" && mode !== "betting"} busy myHandIndex={0} myHandCount={mode === "split" ? 2 : 1} turnLeft={24} canDoubleDown canSplit extendUsed={false} busted={false} onHit={() => {}} onStand={() => {}} onDoubleDown={() => {}} onSplit={() => {}} onVoteSkip={() => {}} onExtend={() => {}} />
    <BlackjackResponsiveTable state={state} currentUserId={1} nameColor={null} prestige={1} turnSeat={0} feltRef={ref} editMode={false} onDrag={() => {}} onPickup={() => {}} />
  </div>;
}
