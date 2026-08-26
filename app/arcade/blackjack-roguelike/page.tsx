"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cardColor,
  CONSUMABLES,
  DECK_PRESETS,
  DIFFICULTIES,
  Difficulty,
  getJoker,
  getPowerup,
  handTotal,
  isBlackjack,
  JOKERS,
  JokerId,
  loadMeta,
  MetaState,
  newRun,
  POWERUPS,
  PowerupId,
  powerupRarityColor,
  recordDiscoveries,
  recordRunEnd,
  recordRoundWin,
  saveMeta,
  RunState,
  deal,
  hit,
  stand,
  doubleDown,
  split,
  redraw,
  startNextRound,
  buyJoker,
  buyConsumable,
  buyPowerup,
  usePowerup,
} from "./game";
import MultiplayerBlackjack from "./multiplayer";

type LastResult = { label: string; color: string; score: number } | null;

// Balatro-style joker rarity colors.
function rarityColor(rarity: "common" | "uncommon" | "rare"): string {
  if (rarity === "rare") return "rgba(176,124,255,.75)";
  if (rarity === "uncommon") return "rgba(77,166,255,.6)";
  return "rgba(255,255,255,.22)";
}

export default function RoguelikeBlackjackPage() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [run, setRun] = useState<RunState | null>(null);
  const [preset, setPreset] = useState("standard");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [menu, setMenu] = useState(true);
  const [shopJokers, setShopJokers] = useState<JokerId[]>([]);
  const [shopConsumables, setShopConsumables] = useState<string[]>([]);
  const [shopPowerups, setShopPowerups] = useState<PowerupId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [multiplayer, setMultiplayer] = useState(false);

  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

  const openShop = useCallback((state: RunState) => {
    const owned = new Set(state.jokers);
    const pool = JOKERS.filter((j) => !owned.has(j.id)).map((j) => j.id);
    setShopJokers([...pool].sort(() => Math.random() - 0.5).slice(0, 3));
    setShopConsumables(CONSUMABLES.map((c) => c.id));
    setShopPowerups([...POWERUPS.map((p) => p.id)].sort(() => Math.random() - 0.5).slice(0, 4));
  }, []);

  const startRun = useCallback(
    (deckPreset: string, diff: Difficulty) => {
      setRun(newRun(deckPreset, diff));
      setMenu(false);
      setShopJokers([]);
      setShopConsumables([]);
      setShopPowerups([]);
      setRemoveMode(false);
    },
    [],
  );

  // Handles post-action meta tracking (round win / run end / discoveries).
  const afterAction = useCallback(
    (next: RunState) => {
      setRun(next);
      if (next.phase === "shop") {
        setMeta((m) => recordRoundWin(recordDiscoveries(next, m), next.round));
        flash(`Round ${next.round} cleared!`);
        openShop(next);
      } else if (next.phase === "gameover") {
        setMeta((m) => recordRunEnd(recordDiscoveries(next, m), next.round));
      } else {
        setMeta((m) => recordDiscoveries(next, m));
      }
    },
    [flash, openShop],
  );

  const doDeal = useCallback(() => {
    if (!run) return;
    setRun(deal(run));
    setRemoveMode(false);
  }, [run]);

  const doHit = useCallback(() => {
    if (!run) return;
    afterAction(hit(run));
  }, [run, afterAction]);

  const doStand = useCallback(() => {
    if (!run) return;
    afterAction(stand(run));
  }, [run, afterAction]);

  const doDoubleDown = useCallback(() => {
    if (!run) return;
    afterAction(doubleDown(run));
  }, [run, afterAction]);

  const doSplit = useCallback(() => {
    if (!run) return;
    setRun(split(run));
  }, [run]);

  const doRedraw = useCallback(() => {
    if (!run) return;
    setRun(redraw(run));
    flash("Hand redrawn.");
  }, [run, flash]);

  const doStartNextRound = useCallback(() => {
    if (!run || run.phase !== "shop") return;
    setRun(startNextRound(run));
    setShopJokers([]);
    setShopConsumables([]);
    setShopPowerups([]);
  }, [run]);

  const doBuyJoker = useCallback(
    (id: JokerId) => {
      if (!run) return;
      const def = getJoker(id);
      if (run.coins < def.cost || run.jokers.includes(id)) return;
      const next = buyJoker(run, id);
      setRun(next);
      setMeta((m) => recordDiscoveries(next, m));
      if (def.onAcquireMessage) flash(def.onAcquireMessage);
      flash(`Bought ${def.name}`);
    },
    [run, flash],
  );

  const doBuyConsumable = useCallback(
    (id: string) => {
      if (!run) return;
      const def = CONSUMABLES.find((c) => c.id === id);
      if (!def || run.coins < def.cost) return;
      const next = buyConsumable(run, def.id);
      setRun(next);
      flash("Deck updated.");
    },
    [run, flash],
  );

  const doBuyPowerup = useCallback(
    (id: PowerupId) => {
      if (!run) return;
      const def = getPowerup(id);
      if (run.coins < def.cost) return;
      const next = buyPowerup(run, id);
      setRun(next);
      setMeta((m) => recordDiscoveries(next, m));
      flash(`Bought ${def.name}`);
    },
    [run, flash],
  );

  const usePw = useCallback(
    (id: PowerupId, cardIndex?: number) => {
      if (!run) return;
      if (id === "remove_card_self" && cardIndex == null) {
        setRemoveMode(true);
        flash("Click a card in your hand to remove it.");
        return;
      }
      const res = usePowerup(run, id, { cardIndex });
      if ("error" in res) {
        flash(res.error);
        return;
      }
      setRun(res.state);
      setRemoveMode(false);
      flash(res.message);
    },
    [run, flash],
  );

  const onCardClick = useCallback(
    (i: number) => {
      if (removeMode) usePw("remove_card_self", i);
    },
    [removeMode, usePw],
  );

  const restart = useCallback(() => {
    setRun(null);
    setMenu(true);
    setRemoveMode(false);
  }, []);

  const progress = run ? Math.min(100, Math.round((run.roundScore / run.target) * 100)) : 0;
  const ownedJokers = useMemo(() => (run ? run.jokers.map(getJoker) : []), [run]);

  const handValue = run && run.hand.length > 0 ? handTotal(run.hand, run.handBonus) : 0;
  const blackjackNow = run && run.playing && run.hand.length === 2 && run.handBonus === 0 && isBlackjack(run.hand);
  const canDoubleDown = !!run && run.playing && !run.pendingBust && run.hand.length === 2 && run.coins > 0;
  const canSplit =
    !!run &&
    run.playing &&
    !run.pendingBust &&
    run.hand.length === 2 &&
    !run.splitHand &&
    run.coins >= 2 &&
    (run.freeSplit || run.hand[0]!.rank === run.hand[1]!.rank);

  const ownedPowerups = useMemo(() => {
    if (!run) return [];
    return (Object.keys(run.powerups) as PowerupId[]).filter((id) => (run.powerups[id] ?? 0) > 0).map((id) => ({ def: getPowerup(id), count: run.powerups[id] ?? 0 }));
  }, [run]);

  const lastResult: LastResult = useMemo(() => {
    if (!run || run.lastOutcome == null || !run.handResult) return null;
    const r = run.handResult;
    const o = run.lastOutcome;
    const label = r.bust
      ? "Bust — house wins"
      : o === "win"
        ? r.blackjack
          ? "Blackjack! You win"
          : r.charlie
            ? "Five-Card Charlie! You win"
            : `You win · ${r.value} vs ${run.lastDealerTotal}`
        : o === "push"
          ? `Push · ${r.value} vs ${run.lastDealerTotal}`
          : `House wins · ${r.value} vs ${run.lastDealerTotal}`;
    const color = r.bust ? "#ff5d8f" : o === "win" ? "#ffd24a" : o === "push" ? "#9b8cff" : "#ff5d8f";
    return { label, color, score: o === "win" ? r.score : 0 };
  }, [run]);

  const showHouseTotal = !!run && run.dealerDone && run.dealer.length > 0;

  if (multiplayer) {
    return <MultiplayerBlackjack onBack={() => setMultiplayer(false)} />;
  }

  return (
    <div className="bjr-root" style={{ minHeight: "100dvh", width: "100%", padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{bjrStyles}</style>

      {menu ? (
        <div className="bjr-menu">
          <div className="bjr-logo">LIQUID GLASS ARCADE</div>
          <h1 className="bjr-subtitle">Roguelike Blackjack</h1>
          <p className="bjr-muted">Roguelike Blackjack is a free single-player deckbuilding card game. Beat each round target by playing blackjack hands, then spend your coins on jokers, deck edits and powerups. Free to play with virtual coins only — no real money, no download.</p>

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

          <div className="bjr-section-title">Difficulty</div>
          <div className="bjr-decks">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} className={`bjr-deck ${difficulty === d.id ? "bjr-deck-active" : ""}`} onClick={() => setDifficulty(d.id)}>
                <div className="bjr-deck-name">{d.name}</div>
                <div className="bjr-deck-desc">{d.desc}</div>
              </button>
            ))}
          </div>

          <div className="bjr-menu-row">
            <button className="bjr-btn bjr-btn-primary" onClick={() => startRun(preset, difficulty)}>Start Run</button>
            <button className="bjr-btn bjr-btn-secondary" onClick={() => setMultiplayer(true)}>Multiplayer</button>
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
                  <div key={j.id} className="bjr-gallery-item" style={{ opacity: meta.discoveredJokers.includes(j.id) ? 1 : 0.3, borderColor: meta.discoveredJokers.includes(j.id) ? rarityColor(j.rarity) : "rgba(255,255,255,.1)" }}>
                    <div className="bjr-gallery-name">{meta.discoveredJokers.includes(j.id) ? j.name : "???"}</div>
                    <div className="bjr-gallery-desc">{meta.discoveredJokers.includes(j.id) ? j.desc : "Not yet discovered"}</div>
                  </div>
                ))}
              </div>
              <div className="bjr-section-title">Discovered powerups</div>
              <div className="bjr-gallery-grid">
                {POWERUPS.map((p) => (
                  <div key={p.id} className="bjr-gallery-item" style={{ opacity: meta.discoveredPowerups.includes(p.id) ? 1 : 0.3, borderColor: meta.discoveredPowerups.includes(p.id) ? powerupRarityColor(p.rarity) : "rgba(255,255,255,.1)" }}>
                    <div className="bjr-gallery-name">{meta.discoveredPowerups.includes(p.id) ? p.name : "???"}</div>
                    <div className="bjr-gallery-desc">{meta.discoveredPowerups.includes(p.id) ? p.desc : "Not yet discovered"}</div>
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

          <div className="bjr-chips-readout" key={run.roundScore}>
            <div className="bjr-chips-number">{run.roundScore.toLocaleString()}</div>
            <div className="bjr-chips-label">Chips</div>
          </div>

          {run.phase === "playing" ? (
            <>
              <div className="bjr-table">
                {run.dealer.length > 0 ? (
                  <div className="bjr-dealer">
                    <div className="bjr-dealer-label">House</div>
                    <div className="bjr-hand">
                      {run.dealer.map((card, i) => {
                        const hidden = run.playing && i === 1 && !run.dealerDone;
                        return (
                          <div key={card.id} className={`bjr-card${hidden ? " bjr-card-hidden" : ""}`} style={{ color: hidden ? undefined : cardColor(card), animationDelay: `${i * 60}ms` }}>
                            {hidden ? (
                              <span className="bjr-card-back">✦</span>
                            ) : (
                              <>
                                <span className="bjr-card-rank">{card.rank}</span>
                                <span className="bjr-card-suit">{card.suit}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {showHouseTotal ? <div className="bjr-dealer-value">House total: {run.lastDealerTotal}</div> : null}
                  </div>
                ) : null}

                {run.splitHand ? (
                  <div className="bjr-split-banner">{run.splitActive ? "Playing hand 2 of 2" : "Playing hand 1 of 2"}</div>
                ) : null}

                {run.stake > 0 ? <div className="bjr-stake-banner">Wager: {run.stake} coins</div> : null}

                {run.pendingBust ? (
                  <div className="bjr-bust-banner">Busted! Use a save powerup below — or accept the loss.</div>
                ) : null}

                {run.peekCard ? (
                  <div className="bjr-peek">Next card: {run.peekCard.rank}{run.peekCard.suit}</div>
                ) : null}

                {run.hand.length > 0 ? (
                  <>
                    <div className="bjr-hand-value" style={{ color: handValue > 21 ? "#ff5d8f" : blackjackNow ? "#ffd24a" : "#eaf6ff" }}>
                      {run.playing ? (blackjackNow ? "Blackjack!" : handValue + (run.handBonus !== 0 ? ` (${run.handBonus >= 0 ? "+" : ""}${run.handBonus})` : "")) : ""}
                    </div>
                    <div className="bjr-hand">
                      {run.hand.map((card, i) => (
                        <div
                          key={card.id}
                          className={`bjr-card${removeMode ? " bjr-card-removable" : ""}`}
                          style={{ color: cardColor(card), animationDelay: `${i * 60}ms` }}
                          onClick={() => onCardClick(i)}
                        >
                          <span className="bjr-card-rank">{card.rank}</span>
                          <span className="bjr-card-suit">{card.suit}</span>
                        </div>
                      ))}
                    </div>
                    {removeMode ? <div className="bjr-remove-hint">Tap a card to remove it</div> : null}
                  </>
                ) : (
                  <div className="bjr-empty">Press Deal to draw your hand</div>
                )}

                {lastResult ? (
                  <div className="bjr-result" style={{ color: lastResult.color }}>
                    {lastResult.label}
                    {lastResult.score > 0 ? ` · +${lastResult.score}` : ""}
                  </div>
                ) : null}

                <div className="bjr-actions">
                  {!run.playing ? (
                    <button className="bjr-btn bjr-btn-primary" disabled={run.handsRemaining <= 0} onClick={doDeal}>Deal</button>
                  ) : run.pendingBust ? (
                    <button className="bjr-btn bjr-btn-danger" onClick={doStand}>Accept loss</button>
                  ) : (
                    <>
                      <button className="bjr-btn bjr-btn-primary" onClick={doHit}>Hit</button>
                      <button className="bjr-btn bjr-btn-secondary" onClick={doStand}>Stand</button>
                      {canDoubleDown ? (
                        <button className="bjr-btn bjr-btn-doubledown" onClick={doDoubleDown}>Double Down</button>
                      ) : null}
                      {canSplit ? (
                        <button className="bjr-btn bjr-btn-split" onClick={doSplit}>Split</button>
                      ) : null}
                      <button className="bjr-btn bjr-btn-ghost" disabled={run.redrawsRemaining <= 0} onClick={doRedraw}>Redraw ({run.redrawsRemaining})</button>
                    </>
                  )}
                </div>
              </div>

              {ownedPowerups.length > 0 ? (
                <div className="bjr-powerups">
                  <div className="bjr-section-title">Powerups</div>
                  <div className="bjr-powerup-list">
                    {ownedPowerups.map(({ def, count }) => (
                      <button
                        key={def.id}
                        className="bjr-powerup-chip"
                        title={def.desc}
                        style={{ borderColor: powerupRarityColor(def.rarity) }}
                        onClick={() => usePw(def.id)}
                      >
                        <b>{def.name}</b>
                        <span className="bjr-powerup-count">×{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bjr-jokers">
                <div className="bjr-section-title">Jokers ({ownedJokers.length})</div>
                {ownedJokers.length === 0 ? (
                  <div className="bjr-muted">No jokers yet. Clear rounds to earn coins and buy them.</div>
                ) : (
                  <div className="bjr-joker-list">
                    {ownedJokers.map((j) => (
                      <div key={j.id} className="bjr-joker-chip" title={j.desc} style={{ borderColor: rarityColor(j.rarity) }}>
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
                  return (
                    <button key={id} className="bjr-shop-item" disabled={run.coins < j.cost} onClick={() => doBuyJoker(id)} style={{ borderColor: rarityColor(j.rarity) }}>
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
                  return (
                    <button key={id} className="bjr-shop-item" disabled={run.coins < c.cost} onClick={() => doBuyConsumable(id)}>
                      <div className="bjr-shop-name">{c.name}</div>
                      <div className="bjr-shop-desc">{c.desc}</div>
                      <div className="bjr-shop-cost">{c.cost} coins</div>
                    </button>
                  );
                })}
              </div>

              <div className="bjr-section-title">Powerups</div>
              <div className="bjr-shop-grid">
                {shopPowerups.map((id) => {
                  const p = getPowerup(id);
                  return (
                    <button key={id} className="bjr-shop-item" disabled={run.coins < p.cost} onClick={() => doBuyPowerup(id)} style={{ borderColor: powerupRarityColor(p.rarity) }}>
                      <div className="bjr-shop-name">{p.name}</div>
                      <div className="bjr-shop-desc">{p.desc}</div>
                      <div className="bjr-shop-cost">{p.cost} coins</div>
                    </button>
                  );
                })}
              </div>

              <div className="bjr-actions">
                <button className="bjr-btn bjr-btn-primary" onClick={doStartNextRound}>Start Round {run.round + 1}</button>
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
    background: radial-gradient(1200px 700px at 50% -10%, rgba(168,85,247,.22), transparent 60%), radial-gradient(900px 500px at 100% 110%, rgba(56,189,248,.14), transparent 60%), linear-gradient(#06060d, #0a0a14);
    color: #eaf6ff;
    overflow-x: hidden;
  }
  .bjr-crt {
    position: fixed; inset: 0; pointer-events: none; z-index: 50;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0px, rgba(255,255,255,.025) 1px, transparent 1px, transparent 3px);
    mix-blend-mode: overlay;
  }
  .bjr-logo { font-size: 38px; font-weight: 900; letter-spacing: .14em; color: #fff; text-shadow: 2px 0 0 rgba(255,60,90,.55), -2px 0 0 rgba(60,200,255,.55), 0 0 28px rgba(168,85,247,.7); }
  .bjr-subtitle { margin: 4px 0 0; color: rgba(255,255,255,.7); font-size: 16px; letter-spacing: .08em; }
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
  .bjr-btn-doubledown { background: linear-gradient(90deg, #ffd24a, #ff9d4a); color: #2a1605; box-shadow: 0 6px 22px rgba(255,158,58,.35); }
  .bjr-btn-split { background: linear-gradient(90deg, #4de3c1, #38bdf8); color: #03231a; box-shadow: 0 6px 22px rgba(56,189,248,.35); }
  .bjr-stats { display: flex; gap: 18px; margin-top: 22px; font-size: 13px; color: rgba(255,255,255,.6); flex-wrap: wrap; }
  .bjr-stats b { color: #fff; }
  .bjr-hud { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
  .bjr-hud > div { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 10px; text-align: center; }
  .bjr-hud-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .bjr-hud-value { font-size: 26px; font-weight: 900; color: #fff; text-shadow: 0 0 16px rgba(168,85,247,.45); }
  .bjr-accent { color: #4de3c1; }
  .bjr-coin { color: #ffd24a; }
  .bjr-progress-track { height: 14px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); overflow: hidden; margin-bottom: 10px; }
  .bjr-progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #a855f7); border-radius: 999px; transition: width .3s ease; }
  .bjr-chips-readout { text-align: center; margin: 4px 0 16px; animation: bjrChipsPop .18s ease; }
  .bjr-chips-number { font-size: 56px; font-weight: 900; line-height: 1; color: #fff; text-shadow: 0 0 22px rgba(168,85,247,.6), 0 2px 0 rgba(0,0,0,.5); letter-spacing: .01em; font-variant-numeric: tabular-nums; }
  .bjr-chips-label { margin-top: 6px; font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .bjr-table { min-height: 340px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 22px; background: rgba(255,255,255,.03); padding: 24px; }
  .bjr-hand { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .bjr-card { width: 94px; height: 136px; border-radius: 16px; background: linear-gradient(160deg, #161d2e 0%, #0a0e18 55%); border: 2px solid rgba(255,255,255,.18); box-shadow: 0 12px 34px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; position: relative; overflow: hidden; animation: bjrDeal .32s cubic-bezier(.2,.7,.3,1) backwards; }
  .bjr-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, rgba(255,255,255,.14) 0%, transparent 42%); pointer-events: none; }
  .bjr-card-rank { font-size: 34px; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
  .bjr-card-suit { font-size: 34px; line-height: 1; filter: drop-shadow(0 0 6px rgba(255,255,255,.22)); }
  .bjr-card-removable { cursor: pointer; border-color: rgba(255,93,143,.7) !important; box-shadow: 0 0 0 2px rgba(255,93,143,.4), 0 12px 34px rgba(0,0,0,.55); }
  .bjr-card-removable:hover { transform: translateY(-4px); }
  .bjr-dealer { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .bjr-dealer-label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .bjr-dealer-value { font-size: 13px; color: rgba(255,255,255,.7); }
  .bjr-card-hidden { border-color: rgba(168,85,247,.45) !important; background: repeating-linear-gradient(45deg, #141a2b, #141a2b 6px, #0c1020 6px, #0c1020 12px) !important; }
  .bjr-card-back { font-size: 30px; color: rgba(168,85,247,.8); }
  .bjr-hand-value { font-size: 20px; font-weight: 700; min-height: 24px; }
  .bjr-empty { color: rgba(255,255,255,.5); font-size: 15px; }
  .bjr-result { font-size: 20px; font-weight: 800; }
  .bjr-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }
  .bjr-split-banner { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #4de3c1; }
  .bjr-stake-banner { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #ffd24a; }
  .bjr-bust-banner { font-size: 14px; font-weight: 700; color: #ff5d8f; background: rgba(255,93,143,.1); border: 1px solid rgba(255,93,143,.45); border-radius: 12px; padding: 10px 16px; text-align: center; animation: bjrPop .18s ease; }
  .bjr-btn-danger { background: linear-gradient(90deg, #ff5d8f, #ff3d6e); color: #2a0510; box-shadow: 0 6px 22px rgba(255,93,143,.35); }
  .bjr-peek { font-size: 13px; color: #9b8cff; }
  .bjr-remove-hint { font-size: 12px; color: #ff5d8f; }
  .bjr-powerups { margin-top: 22px; }
  .bjr-powerup-list { display: flex; gap: 10px; flex-wrap: wrap; }
  .bjr-powerup-chip { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 10px 14px; font-size: 13px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: .15s; }
  .bjr-powerup-chip:hover { background: rgba(255,255,255,.1); transform: translateY(-1px); }
  .bjr-powerup-count { font-weight: 900; color: #ffd24a; }
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
  @keyframes bjrDeal { from { opacity: 0; transform: translateY(16px) scale(.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes bjrChipsPop { from { transform: scale(1.06); } to { transform: scale(1); } }
  @media (max-width: 640px) {
    .bjr-hud { grid-template-columns: repeat(4, 1fr); }
    .bjr-card { width: 72px; height: 104px; }
    .bjr-card-rank, .bjr-card-suit { font-size: 26px; }
  }
`;
