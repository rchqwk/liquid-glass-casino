"use client";

import { useCallback, useRef, useState } from "react";
type Wager = { game: string; wager: number; baseWager?: number };
type Reservation = { nonce: number } | { error: string };

export function useWagerReservationGuard(reserve: (input: Wager) => Promise<Reservation>) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const release = useCallback(() => { locked.current = false; setPending(false); }, []);
  const reserveBet = useCallback(async (input: Wager): Promise<Reservation> => {
    if (locked.current) return { error: "A stake action is already pending." };
    locked.current = true;
    setPending(true);
    try {
      const result = await reserve(input);
      if ("error" in result) release();
      return result;
    } catch {
      release();
      return { error: "Stake reservation could not complete. Check your connection." };
    }
  }, [reserve, release]);
  // A successful reservation stays locked until its table action is acknowledged.
  return { reserveBet, release, pending };
}
