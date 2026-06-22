"server-only";

import type { TableState } from "./blackjackMultiplayer";
import { shortChatId, shortEventId } from "./blackjackUtils";

export function ensureBlackjackRoomFeed(state: TableState) {
  state.chat = Array.isArray(state.chat) ? state.chat : [];
  state.events = Array.isArray(state.events) ? state.events : [];
}

export function appendBlackjackEvent(state: TableState, at: number, text: string, limit = 80) {
  ensureBlackjackRoomFeed(state);
  state.events!.push({ id: shortEventId(), at, text });
  if ((state.events?.length ?? 0) > limit) {
    state.events = state.events!.slice((state.events?.length ?? 0) - limit);
  }
}

export function appendBlackjackChatMessage(
  state: TableState,
  input: { userId: number; username: string; text: string; at: number; prestigeLevel?: number; nameColor?: string | null },
  limit = 120,
) {
  ensureBlackjackRoomFeed(state);
  state.chat!.push({
    id: shortChatId(),
    userId: input.userId,
    username: input.username,
    text: input.text,
    at: input.at,
    prestigeLevel: Number(input.prestigeLevel ?? 0) || 0,
    nameColor: (input.nameColor ?? null) as string | null,
  });
  if ((state.chat?.length ?? 0) > limit) {
    state.chat = state.chat!.slice((state.chat?.length ?? 0) - limit);
  }
}

export function initialBlackjackRoomEvents(now: number, shoeCutCardAt: number) {
  return [
    {
      id: shortEventId(),
      at: now,
      text: `The deck has been shuffled. A new shoe card was placed at card number ${shoeCutCardAt}.`,
    },
  ];
}
