"use client";

import type { RefObject } from "react";
import type { BJState } from "./blackjackTableTypes";
import { CardView, handValue } from "./blackjackUiPrimitives";
import { BlackjackNameBadge } from "./blackjackSeatViews";
import { blackjackCollectibleLabel } from "./blackjackCollectiblesPanel";

type Props = {
  state: BJState;
  currentUserId: number | null;
  nameColor: string | null;
  prestige: number;
  turnSeat: number;
  feltRef: RefObject<HTMLDivElement | null>;
  editMode: boolean;
  onDrag: (id: string) => void;
  onPickup: (id: string) => void;
};

export function BlackjackResponsiveTable({ state, currentUserId, nameColor, prestige, turnSeat, feltRef, editMode, onDrag, onPickup }: Props) {
  const seats = state.seats.map((seat, index) => ({ seat, index })).filter(entry => entry.seat !== null);
  seats.sort((a, b) => Number(b.seat?.userId === currentUserId) - Number(a.seat?.userId === currentUserId) || a.index - b.index);
  return (
    <div className="casino-responsive-felt" ref={feltRef}>
      <section className="casino-dealer" aria-label="Dealer hand">
        <div className="casino-eyebrow">Dealer</div>
        <p className="mt-2 text-sm">Visible total <strong className="font-mono">{handValue(state.dealer.cards.filter(card => card >= 0), state.dealer.bonusPoints).total}</strong></p>
        <div className="casino-dealer__cards">{state.dealer.cards.map((card, index) => <CardView key={index} idx={card} hidden={card < 0} />)}</div>
        {state.dealer.cards.length === 0 ? <p className="mt-3 text-xs text-white/70">Waiting for the next deal</p> : null}
        {state.dealer.effects?.length ? <p className="mt-3 text-xs">{state.dealer.effects.slice(-4).map(effect => effect.powerupName).join(" · ")}</p> : null}
      </section>
      <div className="casino-seat-grid">
        {seats.map(({ seat, index }) => {
          if (!seat) return null;
          const self = seat.userId === currentUserId;
          const turn = state.phase === "player_turns" && turnSeat === index;
          const hands = seat.hands?.length ? seat.hands : [{ cards: seat.cards, bonusPoints: seat.bonusPoints }];
          return (
            <section key={index} className={`casino-seat ${self ? "casino-seat--self" : ""} ${turn ? "casino-seat--turn" : ""}`} aria-label={`Seat ${index + 1}, ${seat.username}${self ? ", your seat" : ""}`}>
              <div className="casino-seat-heading">
                <div className="flex flex-wrap items-center gap-2"><BlackjackNameBadge seat={seat} currentUserId={currentUserId} currentUserNameColor={nameColor} currentUserPrestigeLevel={prestige} />{self ? <span className="casino-tag">You</span> : null}{turn ? <span className="casino-tag">{self ? "Your turn" : "Playing"}</span> : null}</div>
                <span className="font-mono">{seat.bet.toFixed(2)} ⓒ{seat.allIn ? " · ALL IN" : ""}</span>
              </div>
              {hands.map((hand, handIndex) => {
                const total = handValue(hand.cards, hand.bonusPoints).total;
                const active = hands.length > 1 && handIndex === (seat.activeHandIndex ?? 0);
                return <div key={handIndex} className={`casino-hand ${active ? "casino-hand--active" : ""}`}>
                  <p>{hands.length > 1 ? `Hand ${handIndex + 1} · ` : ""}Total <strong className="font-mono text-white">{total}</strong>{total > 21 ? " · Busted" : seat.stood ? " · Stood" : ""}{active ? " · Active hand" : ""}</p>
                  <div className="casino-seat-cards">{hand.cards.map((card, cardIndex) => <CardView key={cardIndex} idx={card} hidden={card < 0} winning={total === 21} />)}</div>
                  {hand.effects?.length ? <p className="mt-2">{hand.effects.slice(-3).map(effect => effect.powerupName).join(" · ")}</p> : null}
                </div>;
              })}
              {seat.cards.length === 0 ? <p className="mt-2 text-xs text-white/70">Waiting for cards</p> : null}
            </section>
          );
        })}
      </div>
      <p className="casino-open-seats">{10 - seats.length} open seats · {state.spectators.length} watching{editMode ? " · Drag your decorations to move them" : ""}</p>
      <div className="casino-decoration-layer">
        {(state.decorations ?? []).map(decoration => {
          const editable = editMode && decoration.ownerUserId === currentUserId;
          return <div key={decoration.id} className={`absolute -translate-x-1/2 -translate-y-1/2 ${editable ? "pointer-events-auto" : "pointer-events-none"}`} style={{ left: `${Math.max(0, Math.min(1, decoration.x)) * 100}%`, top: `${Math.max(0, Math.min(1, decoration.y)) * 100}%` }} onPointerDown={event => { if (editable) { event.preventDefault(); event.stopPropagation(); onDrag(decoration.id); } }}>
            {editable ? <button type="button" aria-label="Return decoration to inventory" className="casino-secondary rounded-lg px-2" onPointerDown={event => event.stopPropagation()} onClick={() => onPickup(decoration.id)}>×</button> : null}
            {decoration.kind === "figurine" ? <img src={decoration.imageUrl} alt="Table decoration" className="h-12 w-12 rounded-xl object-cover" /> : <span className="text-3xl">{blackjackCollectibleLabel(decoration.key ?? "")}</span>}
          </div>;
        })}
      </div>
    </div>
  );
}
