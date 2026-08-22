"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildDeckForPreset,
  cardColor,
  CONSUMABLES,
  coinsForWin,
  computeHandValue,
  DECK_PRESETS,
  getJoker,
  handsForRun,
  isBlackjack,
  JOKERS,
  JokerId,
  loadMeta,
  MetaState,
  newRun,
  recordDiscoveries,
  recordRunEnd,
  recordRoundWin,
  redrawsForRun,
  saveMeta,
  scoreHand,
  targetForRound,
  ConsumableId,
  Card,
  RunState,
} from "./game";

type LastResult = { score: number; value: number; label: string; color: string } | null;

export default function RoguelikeBlackjackPage() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [run, setRun] = useState<RunState | null>(null);
  const [preset, setPreset] = useState("standard");
  const [menu, setMenu] = useState(true);
  const [lastResult, setLastResult] = useState<LastResult>(null);
  const [shopJokers, setShopJokers] = useState<JokerId[]>([]);
  const [shopConsumables, setShopConsumables] = useState<ConsumableId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

  const startRun = useCallback(
    (deckPreset: string) => {
      setRun(newRun(deckPreset));
      setMenu(false);
      setLastResult(null);
      setShopJokers([]);
      setShopConsumables([]);
    },
    [],
  );

  const openShop = useCallback((state: RunState) => {
    const owned = new Set(state.jokers);
    const pool = JOKERS.filter((j) => !owned.has(j.id)).map((j) => j.id);
    // Random 3 jokers per shop visit.
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    setShopJokers(shuffled);
    setShopConsumables(CONSUMABLES.map((c) => c.id));
  }, []);

  const deal = useCallback(() => {
    if (!run || run.phase !== "playing" || run.playing || run.handsRemaining <= 0) return;
    let deck = [...run.deck];
    if (deck.length < 2) deck = buildDeckForPreset(preset).sort(() => Math.random() - 0.5);
    const hand: Card[] = [deck.shift()!, deck.shift()!];
    setLastResult(null);
    setRun({ ...run, deck, hand, playing: true, handsRemaining: run.handsRemaining - 1 });
  }, [run, preset]);

  const finishHand = useCallback(
    (state: RunState, hand: Card[]) => {
      const result = scoreHand(state, hand);
      const label = result.blackjack
        ? "Blackjack!"
        : result.charlie
          ? "Five-Card Charlie!"
          : result.bust
            ? "Bust"
            : `Stand · ${result.value}`;
      const color = result.blackjack ? "#ffd24a" : result.charlie ? "#9b8cff" : result.bust ? "#ff5d8f" : "#4de3c1";
      setLastResult({ score: result.score, value: result.value, label, color });

      const roundScore = state.roundScore + result.score;
      const next: RunState = { ...state, roundScore, hand: [], playing: false, handResult: null };

      if (roundScore >= state.target) {
        const overkill = roundScore - state.target;
        const gained = coinsForWin(state.round, overkill);
        const final: RunState = { ...next, phase: "shop", coins: next.coins + gained };
        setRun(final);
        openShop(final);
        setMeta(recordRoundWin(recordDiscoveries(final, meta), state.round));
        flash(`Round ${state.round} cleared! +${gained} coins`);
        return;
      }

      if (next.handsRemaining <= 0) {
        const ended: RunState = { ...next, phase: "gameover" };
        setRun(ended);
        setMeta(recordRunEnd(recordDiscoveries(ended, meta), state.round));
        return;
      }

      setRun(next);
    },
    [meta, openShop, flash],
  );

  const hit = useCallback(() => {
    if (!run || !run.playing || run.phase !== "playing") return;
    let deck = [...run.deck];
    if (deck.length === 0) deck = buildDeckForPreset(preset).sort(() => Math.random() - 0.5);
    const card = deck.shift()!;
    const hand = [...run.hand, card];
    const value = computeHandValue(hand);

    if (value > 21) {
      if (run.jokers.includes("soft_touch")) {
        const saved = hand.slice(0, -1);
        flash("Soft Touch saved the bust!");
        finishHand({ ...run, deck, hand: saved }, saved);
        return;
      }
      finishHand({ ...run, deck, hand }, hand);
      return;
    }
    setRun({ ...run, deck, hand });
  }, [run, preset, finishHand, flash]);

  const stand = useCallback(() => {
    if (!run || !run.playing || run.phase !== "playing") return;
    finishHand(run, run.hand);
  }, [run, finishHand]);

  const mulligan = useCallback(() => {
    if (!run || !run.playing || run.redrawsRemaining <= 0) return;
    let deck = [...run.deck];
    if (deck.length < 2) deck = buildDeckForPreset(preset).sort(() => Math.random() - 0.5);
    const hand: Card[] = [deck.shift()!, deck.shift()!];
    setLastResult(null);
    flash("Hand redrawn.");
    setRun({ ...run, deck, hand, redrawsRemaining: run.redrawsRemaining - 1 });
  }, [run, preset, flash]);

  const startNextRound = useCallback(() => {
    if (!run || run.phase !== "shop") return;
    const round = run.round + 1;
    setRun({
      ...run,
      round,
      target: targetForRound(round),
      roundScore: 0,
      handsRemaining: handsForRun(run),
      redrawsRemaining: redrawsForRun(run),
      hand: [],
      playing: false,
      phase: "playing",
    });
    setLastResult(null);
  }, [run]);

  const buyJoker = useCallback(
    (id: JokerId) => {
      if (!run) return;
      const def = getJoker(id);
      if (run.coins < def.cost || run.jokers.includes(id)) return;
      let deck = run.deck;
      if (def.onAcquire) {
        deck = def.onAcquire(deck);
        if (def.onAcquireMessage) flash(def.onAcquireMessage);
      }
      const next = { ...run, coins: run.coins - def.cost, jokers: [...run.jokers, id], deck };
      setRun(next);
      setMeta(recordDiscoveries(next, meta));
      flash(`Bought ${def.name}`);
    },
    [run, meta, flash],
  );

  const buyConsumable = useCallback(
    (id: ConsumableId) => {
      if (!run) return;
      const def = CONSUMABLES.find((c) => c.id === id)!;
      if (run.coins < def.cost) return;
      const { deck, message } = def.apply(run.deck);
      flash(message);
      setRun({ ...run, coins: run.coins - def.cost, deck });
    },
    [run, flash],
  );

  const restart = useCallback(() => {
    setRun(null);
    setMenu(true);
    setLastResult(null);
  }, []);

  const progress = run ? Math.min(100, Math.round((run.roundScore / run.target) * 100)) : 0;

  const ownedJokers = useMemo(() => (run ? run.jokers.map(getJoker) : []), [run]);
  const handValue = run && run.hand.length > 0 ? computeHandValue(run.hand) : 0;
  const blackjackNow = run && run.playing && run.hand.length === 2 && isBlackjack(run.hand);

  return (
    <div className="bjr-root" style={{ minHeight: "100dvh", width: "100%", padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{bjrStyles}</style>

      {menu ? (
        <div className="bjr-menu">
          <div className="bjr-logo">LIQUID GLASS ARCADE</div>
          <div className="bjr-subtitle">Roguelike Blackjack</div>
          <p className="bjr-muted">Beat the round target by playing blackjack hands. Spend your winnings on jokers and deck edits. Go as far as you can.</p>

          <div className="bjr-section-title">Choose your deck</div>
          <div className="bjr-decks">
            {DECK_PRESETS.map((d) => {
              const locked = !meta.unlockedDecks.includes(d.id);
              return (
                <button
                  key={d.id}
                  className={`bjr-deck ${preset === d.id && !locked ? "bjr-deck-active" : ""}`}
                  disabled={locked}
                  onClick={() => setPreset(d.id)}
                  style={{ opacity: locked ? 0.4 : 1 }}
                >
                  <div className="bjr-deck-name">{locked ? "🔒 Locked" : d.name}</div>
                  <div className="bjr-deck-desc">{locked ? `Reach round ${d.unlockRound} to unlock` : d.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="bjr-menu-row">
            <button className="bjr-btn bjr-btn-primary" onClick={() => startRun(preset)}>Start Run</button>
            <button className="bjr-btn bjr-btn-ghost" onClick={() => setGalleryOpen((v) => !v)}>Collection</button>
          </div>

          <div className="bjr-stats">
            <div>Best round: <b>{meta.bestRound}</b></div>
            <div>Rounds won: <b>{meta.totalWins}</b></div>
            <div>Runs played: <b>{meta.runsPlayed}</b></div>
          </div>

          {galleryOpen ? (
            <div className="bjr-gallery">
              <div className="bjr-section-title">Discovered jokers</div>
              <div className="bjr-gallery-grid">
                {JOKERS.map((j) => (
                  <div key={j.id} className="bjr-gallery-item" style={{ opacity: meta.discoveredJokers.includes(j.id) ? 1 : 0.3 }}>
                    <div className="bjr-gallery-name">{meta.discoveredJokers.includes(j.id) ? j.name : "???"}</div>
                    <div className="bjr-gallery-desc">{meta.discoveredJokers.includes(j.id) ? j.desc : "Not yet discovered"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : run ? (
        <div className="bjr-game">
          <div className="bjr-crt" />

          <header className="bjr-hud">
            <div>
              <div className="bjr-hud-label">Round</div>
              <div className="bjr-hud-value">{run.round}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Target</div>
              <div className="bjr-hud-value bjr-accent">{run.target}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Score</div>
              <div className="bjr-hud-value bjr-accent">{run.roundScore}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Hands</div>
              <div className="bjr-hud-value">{run.handsRemaining}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Redraws</div>
              <div className="bjr-hud-value">{run.redrawsRemaining}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Coins</div>
              <div className="bjr-hud-value bjr-coin">{run.coins}</div>
            </div>
            <div>
              <div className="bjr-hud-label">Deck</div>
              <div className="bjr-hud-value">{run.deck.length}</div>
            </div>
          </header>

          <div className="bjr-progress-track">
            <div className="bjr-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {run.phase === "playing" ? (
            <>
              <div className="bjr-table">
                {run.hand.length > 0 ? (
                  <>
                    <div className="bjr-hand-value" style={{ color: handValue > 21 ? "#ff5d8f" : blackjackNow ? "#ffd24a" : "#eaf6ff" }}>
                      {run.playing ? (blackjackNow ? "Blackjack!" : handValue) : ""}
                    </div>
                    <div className="bjr-hand">
                      {run.hand.map((card) => (
                        <div key={card.id} className="bjr-card" style={{ color: cardColor(card) }}>
                          <span className="bjr-card-rank">{card.rank}</span>
                          <span className="bjr-card-suit">{card.suit}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bjr-empty">Press Deal to draw your hand</div>
                )}

                {lastResult ? (
                  <div className="bjr-result" style={{ color: lastResult.color }}>
                    {lastResult.label} · +{lastResult.score}
                  </div>
                ) : null}

                <div className="bjr-actions">
                  {!run.playing ? (
                    <button className="bjr-btn bjr-btn-primary" disabled={run.handsRemaining <= 0} onClick={deal}>Deal</button>
                  ) : (
                    <>
                      <button className="bjr-btn bjr-btn-primary" onClick={hit}>Hit</button>
                      <button className="bjr-btn bjr-btn-secondary" onClick={stand}>Stand</button>
                      <button className="bjr-btn bjr-btn-ghost" disabled={run.redrawsRemaining <= 0} onClick={mulligan}>Redraw ({run.redrawsRemaining})</button>
                    </>
                  )}
                </div>
              </div>

              <div className="bjr-jokers">
                <div className="bjr-section-title">Jokers ({ownedJokers.length})</div>
                {ownedJokers.length === 0 ? (
                  <div className="bjr-muted">No jokers yet. Clear rounds to earn coins and buy them.</div>
                ) : (
                  <div className="bjr-joker-list">
                    {ownedJokers.map((j) => (
                      <div key={j.id} className="bjr-joker-chip" title={j.desc}>
                        <b>{j.name}</b>
                        <span className="bjr-muted">{j.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : run.phase === "shop" ? (
            <div className="bjr-shop">
              <div className="bjr-section-title">Shop — Round {run.round} cleared</div>
              <div className="bjr-muted">Spend your coins, then start the next round.</div>

              <div className="bjr-section-title">Jokers</div>
              <div className="bjr-shop-grid">
                {shopJokers.map((id) => {
                  const j = getJoker(id);
                  const canAfford = run.coins >= j.cost;
                  return (
                    <button key={id} className="bjr-shop-item" disabled={!canAfford} onClick={() => buyJoker(id)}>
                      <div className="bjr-shop-name">{j.name}</div>
                      <div className="bjr-shop-desc">{j.desc}</div>
                      <div className="bjr-shop-cost">{j.cost} coins</div>
                    </button>
                  );
                })}
                {shopJokers.length === 0 ? <div className="bjr-muted">No jokers available.</div> : null}
              </div>

              <div className="bjr-section-title">Deck edits</div>
              <div className="bjr-shop-grid">
                {shopConsumables.map((id) => {
                  const c = CONSUMABLES.find((x) => x.id === id)!;
                  const canAfford = run.coins >= c.cost;
                  return (
                    <button key={id} className="bjr-shop-item" disabled={!canAfford} onClick={() => buyConsumable(id)}>
                      <div className="bjr-shop-name">{c.name}</div>
                      <div className="bjr-shop-desc">{c.desc}</div>
                      <div className="bjr-shop-cost">{c.cost} coins</div>
                    </button>
                  );
                })}
              </div>

              <div className="bjr-actions">
                <button className="bjr-btn bjr-btn-primary" onClick={startNextRound}>Start Round {run.round + 1}</button>
              </div>
            </div>
          ) : (
            <div className="bjr-gameover">
              <div className="bjr-logo">RUN OVER</div>
              <p className="bjr-muted">You reached round {run.round}.</p>
              <div className="bjr-stats">
                <div>Best round: <b>{meta.bestRound}</b></div>
                <div>Runs played: <b>{meta.runsPlayed}</b></div>
              </div>
              <button className="bjr-btn bjr-btn-primary" onClick={restart}>New Run</button>
            </div>
          )}
        </div>
      ) : null}

      {toast ? <div className="bjr-toast">{toast}</div> : null}
    </div>
  );
}

const bjrStyles = `
  .bjr-root {
    background: radial-gradient(1200px 600px at 50% -10%, rgba(168,85,247,.18), transparent 60%), linear-gradient(#05070f, #070a14);
    color: #eaf6ff;
    overflow-x: hidden;
  }
  .bjr-crt {
    position: fixed; inset: 0; pointer-events: none; z-index: 50;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0px, rgba(255,255,255,.025) 1px, transparent 1px, transparent 3px);
    mix-blend-mode: overlay;
  }
  .bjr-logo { font-size: 34px; font-weight: 800; letter-spacing: .12em; color: #fff; text-shadow: 0 0 24px rgba(168,85,247,.65); }
  .bjr-subtitle { margin-top: 4px; color: rgba(255,255,255,.7); font-size: 16px; letter-spacing: .08em; }
  .bjr-muted { color: rgba(255,255,255,.55); font-size: 13px; line-height: 1.6; }
  .bjr-section-title { margin: 18px 0 10px; font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); }
  .bjr-menu, .bjr-game { max-width: 820px; margin: 0 auto; position: relative; z-index: 1; }
  .bjr-decks { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 8px; }
  .bjr-deck { text-align: left; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); cursor: pointer; color: #fff; transition: .15s; }
  .bjr-deck:hover { background: rgba(255,255,255,.09); }
  .bjr-deck-active { border-color: rgba(168,85,247,.8); box-shadow: 0 0 0 1px rgba(168,85,247,.8); }
  .bjr-deck-name { font-weight: 700; font-size: 14px; }
  .bjr-deck-desc { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,.6); }
  .bjr-menu-row { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
  .bjr-btn { border: none; border-radius: 14px; padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; transition: .15s; }
  .bjr-btn:disabled { opacity: .35; cursor: not-allowed; }
  .bjr-btn-primary { background: linear-gradient(90deg, #38bdf8, #a855f7); color: #05070f; box-shadow: 0 8px 30px rgba(168,85,247,.35); }
  .bjr-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
  .bjr-btn-secondary { background: rgba(255,255,255,.1); color: #fff; border: 1px solid rgba(255,255,255,.15); }
  .bjr-btn-ghost { background: transparent; color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,.15); }
  .bjr-stats { display: flex; gap: 18px; margin-top: 22px; font-size: 13px; color: rgba(255,255,255,.6); flex-wrap: wrap; }
  .bjr-stats b { color: #fff; }
  .bjr-hud { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 12px; }
  .bjr-hud > div { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 10px; text-align: center; }
  .bjr-hud-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .bjr-hud-value { font-size: 22px; font-weight: 800; color: #fff; }
  .bjr-accent { color: #4de3c1; }
  .bjr-coin { color: #ffd24a; }
  .bjr-progress-track { height: 14px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); overflow: hidden; margin-bottom: 22px; }
  .bjr-progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #a855f7); border-radius: 999px; transition: width .3s ease; }
  .bjr-table { min-height: 340px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 22px; background: rgba(255,255,255,.03); padding: 24px; }
  .bjr-hand { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .bjr-card { width: 92px; height: 132px; border-radius: 14px; background: linear-gradient(180deg, #0f1420, #0a0e18); border: 1px solid rgba(255,255,255,.16); box-shadow: 0 10px 30px rgba(0,0,0,.5); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; }
  .bjr-card-rank { font-size: 34px; }
  .bjr-card-suit { font-size: 34px; line-height: 1; }
  .bjr-hand-value { font-size: 20px; font-weight: 700; min-height: 24px; }
  .bjr-empty { color: rgba(255,255,255,.5); font-size: 15px; }
  .bjr-result { font-size: 20px; font-weight: 800; }
  .bjr-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
  .bjr-jokers { margin-top: 22px; }
  .bjr-joker-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .bjr-joker-chip { background: rgba(168,85,247,.12); border: 1px solid rgba(168,85,247,.35); border-radius: 14px; padding: 10px 14px; font-size: 13px; max-width: 240px; }
  .bjr-shop { margin-top: 6px; }
  .bjr-shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .bjr-shop-item { text-align: left; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); cursor: pointer; color: #fff; transition: .15s; }
  .bjr-shop-item:hover:not(:disabled) { background: rgba(255,255,255,.09); }
  .bjr-shop-item:disabled { opacity: .35; cursor: not-allowed; }
  .bjr-shop-name { font-weight: 700; font-size: 14px; }
  .bjr-shop-desc { margin-top: 6px; font-size: 12px; color: rgba(255,255,255,.6); }
  .bjr-shop-cost { margin-top: 10px; font-size: 12px; font-weight: 700; color: #ffd24a; }
  .bjr-gameover { text-align: center; padding: 40px 20px; border: 1px solid rgba(255,255,255,.1); border-radius: 22px; background: rgba(255,255,255,.03); }
  .bjr-gameover .bjr-logo { color: #ff5d8f; text-shadow: 0 0 24px rgba(255,93,143,.5); }
  .bjr-gameover .bjr-stats { justify-content: center; }
  .bjr-gameover .bjr-btn { margin-top: 20px; }
  .bjr-gallery { margin-top: 22px; }
  .bjr-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
  .bjr-gallery-item { padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); }
  .bjr-gallery-name { font-weight: 700; font-size: 13px; }
  .bjr-gallery-desc { margin-top: 4px; font-size: 11px; color: rgba(255,255,255,.55); }
  .bjr-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(10,14,24,.95); border: 1px solid rgba(168,85,247,.4); color: #fff; border-radius: 14px; padding: 12px 18px; font-size: 14px; font-weight: 600; box-shadow: 0 12px 40px rgba(0,0,0,.5); animation: bjrPop .2s ease; }
  @keyframes bjrPop { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  @media (max-width: 640px) {
    .bjr-hud { grid-template-columns: repeat(4, 1fr); }
    .bjr-card { width: 72px; height: 104px; }
    .bjr-card-rank, .bjr-card-suit { font-size: 26px; }
  }
`;
