"server-only";

export function normalizeHandsForSeat(p: any) {
  if (!p) return;
  if (typeof p.lastBetPlaced !== "number" || !Number.isFinite(p.lastBetPlaced)) p.lastBetPlaced = 0;
  if (typeof p.carryBetNext !== "number" || !Number.isFinite(p.carryBetNext)) p.carryBetNext = 0;
  if (!Array.isArray(p.hands) || p.hands.length === 0) {
    p.hands = [
      {
        bet: Number(p.bet ?? 0) || 0,
        nonces: Array.isArray(p.nonces) ? p.nonces : [],
        perfectPairsWager: 0,
        perfectPairsNonce: null,
        perfectPairsSettled: false,
        cards: Array.isArray(p.cards) ? p.cards : [],
        bonusPoints: Number(p.bonusPoints ?? 0) || 0,
        stood: !!p.stood,
        busted: !!p.busted,
        turnEnded: !!p.turnEnded,
        doublePayoutArmed: !!p.doublePayoutArmed,
        usedThisRound: (p.usedThisRound ?? {}) as any,
      },
    ];
    p.activeHandIndex = 0;
  }
  if (typeof p.activeHandIndex !== "number" || !Number.isFinite(p.activeHandIndex)) p.activeHandIndex = 0;
  if (p.activeHandIndex < 0) p.activeHandIndex = 0;
  if (p.activeHandIndex >= p.hands.length) p.activeHandIndex = p.hands.length - 1;

  for (const h of p.hands) {
    if (!h) continue;
    h.bet = Number(h.bet ?? 0) || 0;
    h.nonces = Array.isArray(h.nonces) ? h.nonces : [];
    h.perfectPairsWager = Number(h.perfectPairsWager ?? 0) || 0;
    h.perfectPairsNonce = h.perfectPairsNonce == null ? null : Number(h.perfectPairsNonce);
    if (!Number.isFinite(h.perfectPairsNonce)) h.perfectPairsNonce = null;
    h.perfectPairsSettled = !!h.perfectPairsSettled;
    h.cards = Array.isArray(h.cards) ? h.cards : [];
    h.bonusPoints = Number(h.bonusPoints ?? 0) || 0;
    h.stood = !!h.stood;
    h.busted = !!h.busted;
    h.turnEnded = !!h.turnEnded;
    h.doublePayoutArmed = !!h.doublePayoutArmed;
    h.usedThisRound = (h.usedThisRound ?? {}) as any;
    h.effects = Array.isArray(h.effects) ? h.effects : [];
  }

  const cur = p.hands[p.activeHandIndex] ?? p.hands[0];
  if (cur) {
    p.bet = cur.bet;
    p.cards = cur.cards;
    p.bonusPoints = cur.bonusPoints;
    p.stood = cur.stood;
    p.busted = cur.busted;
    p.turnEnded = cur.turnEnded;
    p.doublePayoutArmed = cur.doublePayoutArmed;
    p.usedThisRound = cur.usedThisRound;
  }
}
