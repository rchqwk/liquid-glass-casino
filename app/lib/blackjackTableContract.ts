"server-only";

import { NextResponse } from "next/server";
import type { TableState } from "./blackjackMultiplayer";
import { safePublicBlackjackStateForUser } from "./blackjackStateView";

type BlackjackTableResponseOptions = {
  status?: number;
  error?: string;
  extra?: Record<string, unknown>;
};

export function buildBlackjackTablePayload(state: TableState, userId: number, extra?: Record<string, unknown>) {
  const publicState = safePublicBlackjackStateForUser(state, userId);
  const meSeatIndex = Number(publicState.meSeatIndex ?? -1);
  const isSeated = meSeatIndex >= 0;
  const spectators = Array.isArray(state.spectators) ? state.spectators : [];
  const isSpectator = !isSeated && spectators.includes(userId);
  const currentTurnSeatIndex = state.phase === "player_turns" ? (state.participants?.[state.turnIndex] ?? null) : null;
  const currentTurnUserId = currentTurnSeatIndex != null ? (state.seats?.[currentTurnSeatIndex]?.userId ?? null) : null;

  return {
    ...(extra ?? {}),
    state: publicState,
    meta: {
      tableId: state.id,
      name: state.name,
      public: !!state.public,
      phase: state.phase,
      round: Number(state.round ?? 0) || 0,
      seatCount: (state.seats ?? []).filter(Boolean).length,
      spectatorCount: spectators.length,
      meSeatIndex,
      isSeated,
      isSpectator,
      canChat: isSeated || isSpectator,
      currentTurnSeatIndex,
      currentTurnUserId,
      bettingEndsAt: Number(state.bettingEndsAt ?? 0) || 0,
      turnEndsAt: Number(state.turnEndsAt ?? 0) || 0,
      dealerWindowEndsAt: Number(state.dealerWindowEndsAt ?? 0) || 0,
      updatedAt: Number(state.updatedAt ?? 0) || 0,
      lastActivityAt: Number(state.lastActivityAt ?? 0) || 0,
    },
  };
}

export function blackjackTableJsonResponse(state: TableState, userId: number, options?: BlackjackTableResponseOptions) {
  const payload = buildBlackjackTablePayload(state, userId, {
    ...(options?.error ? { error: options.error } : {}),
    ...(options?.extra ?? {}),
  });
  return NextResponse.json(payload, options?.status ? { status: options.status } : undefined);
}
