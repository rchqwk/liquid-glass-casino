"use client";

import { useEffect, useState } from "react";
type Summary = { cards: Array<{ id: string; category: string; count: number; name: string }>; bonusPoints: number; boxes: number; bonds: number; activeBondValue: number | null; decorations: Record<string, number>; figurines: number };

export function InventorySummary({ userId, onOpenBoxes }: { userId: number | null; onOpenBoxes: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/blackjack/inventory", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error("Inventory unavailable");
        if (!cancelled) { setSummary(data); setError(false); }
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [userId, retry]);
  if (!userId) return <p className="casino-notice mb-5">Sign in to see your owned cards, bonds, and decorations.</p>;
  if (error) return <div className="casino-error mb-5" role="alert">Your inventory could not load.<button type="button" className="casino-button casino-secondary ml-3" onClick={() => { setError(false); setRetry(value => value + 1); }}>Retry inventory</button></div>;
  if (!summary) return <p role="status" className="casino-muted mb-5">Loading your inventory…</p>;
  return <div className="mb-6 space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="casino-panel"><div className="casino-muted text-xs">Bonus points</div><strong className="font-mono">{summary.bonusPoints}</strong></div>
      <div className="casino-panel"><div className="casino-muted text-xs">Bonds owned</div><strong className="font-mono">{summary.bonds}</strong>{summary.activeBondValue !== null ? <p className="mt-2 text-xs">Recorded active value: {summary.activeBondValue.toFixed(2)} ⓒ</p> : null}</div>
    </div>
    <h3 className="font-semibold">Your power-ups</h3>
    {summary.cards.length ? <ul className="space-y-2">{summary.cards.map(card => <li key={card.id} className="casino-table-row"><span>{card.name}<small className="casino-muted ml-2">{card.category}</small></span><strong className="font-mono">×{card.count}</strong></li>)}</ul> : <p className="casino-muted text-sm">No power-ups yet. Earn boxes through Blackjack play.</p>}
    <p className="casino-muted text-sm">{Object.values(summary.decorations).reduce((sum, count) => sum + count, 0)} decorations · {summary.figurines} figurines</p>
    <button type="button" className="casino-button casino-secondary" onClick={onOpenBoxes}>Mystery boxes · {summary.boxes} unopened</button>
  </div>;
}
