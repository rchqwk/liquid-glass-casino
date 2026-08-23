"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardColor, computeHandValue, type Card } from "./game";

type MpOutcome = "win" | "lose" | "push" | null;
type Mode = "coop" | "race" | "elimination";
type SupportId = "add2" | "add1" | "sub2" | "draw";

const SUPPORT_LABELS: Record<SupportId, string> = {
  add2: "+2 Points",
  add1: "+1 Point",
  sub2: "-2 Save",
  draw: "Draw Card",
};

const MODE_LABELS: Record<Mode, string> = {
  coop: "Co-op",
  race: "Race",
  elimination: "Elimination",
};

interface MpPlayer {
  playerId: string;
  username: string;
  hands: Card[][];
  handBonuses: number[];
  activeHand: number;
  stood: boolean[];
  outcomes: MpOutcome[];
  results: ({ value: number; blackjack: boolean; charlie: boolean; bust: boolean } | null)[];
  done: boolean;
  eliminated: boolean;
  wins: number;
  support: Partial<Record<SupportId, number>>;
}

interface MpRoom {
  code: string;
  hostId: string;
  mode: Mode;
  phase: "lobby" | "playing" | "reveal";
  round: number;
  dealer: Card[];
  players: MpPlayer[];
  deckCount: number;
  youId: string;
  runEnded: boolean;
  xp: { playerId: string; username: string; amount: number }[] | null;
}

function getPlayerId(): string {
  const KEY = "lgc.bjroguelike.playerId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "p" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "p" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function outcomeColor(o: MpOutcome): string {
  if (o === "win") return "#ffd24a";
  if (o === "push") return "#9b8cff";
  return "#ff5d8f";
}

function outcomeLabel(o: MpOutcome): string {
  if (o === "win") return "Win";
  if (o === "push") return "Push";
  return "Lose";
}

export default function MultiplayerBlackjack({ onBack }: { onBack: () => void }) {
  const playerId = useMemo(() => getPlayerId(), []);
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<Mode>("coop");
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<MpRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<string | null>(null);
  const codeRef = useRef<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2400);
  }, []);

  const poll = useCallback(async () => {
    const c = codeRef.current;
    if (!c) return;
    try {
      const res = await fetch(`/api/roguelike/rooms/${c}?playerId=${encodeURIComponent(playerId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.room) setRoom(data.room as MpRoom);
    } catch {
      // ignore transient network errors
    }
  }, [playerId]);

  useEffect(() => {
    if (!code) return;
    codeRef.current = code;
    poll();
    const t = window.setInterval(poll, 1500);
    return () => window.clearInterval(t);
  }, [code, poll]);

  const action = useCallback(
    async (act: string, extra?: { targetId?: string; supportId?: string }) => {
      if (!code || busy) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/roguelike/rooms/${code}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, action: act, ...extra }),
        });
        const data = await res.json();
        if (data.error) flash(data.error);
        else if (data.room) setRoom(data.room as MpRoom);
      } catch {
        flash("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [code, busy, playerId, flash],
  );

  const createRoom = useCallback(async () => {
    if (!username.trim()) {
      flash("Enter a name first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/roguelike/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, username: username.trim(), mode }),
      });
      const data = await res.json();
      if (data.room) {
        setCode(data.room.code);
        setRoom(data.room as MpRoom);
      } else flash(data.error ?? "Failed to create room.");
    } catch {
      flash("Network error.");
    } finally {
      setBusy(false);
    }
  }, [username, mode, playerId, flash]);

  const joinRoom = useCallback(async () => {
    if (!username.trim() || !joinCode.trim()) {
      flash("Enter a name and room code.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/roguelike/rooms/${joinCode.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, username: username.trim() }),
      });
      const data = await res.json();
      if (data.room) {
        setCode(data.room.code);
        setRoom(data.room as MpRoom);
      } else flash(data.error ?? "Failed to join room.");
    } catch {
      flash("Network error.");
    } finally {
      setBusy(false);
    }
  }, [username, joinCode, playerId, flash]);

  const leave = useCallback(async () => {
    if (code) {
      try {
        await fetch(`/api/roguelike/rooms/${code}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId }),
        });
      } catch {
        // ignore
      }
    }
    setCode(null);
    setRoom(null);
    onBack();
  }, [code, playerId, onBack]);

  const me = room?.players.find((p) => p.playerId === playerId) ?? null;
  const others = room?.players.filter((p) => p.playerId !== playerId) ?? [];
  const totalPlayers = room?.players.length ?? 1;
  const otherScale = totalPlayers <= 2 ? 0.72 : totalPlayers === 3 ? 0.56 : 0.44;

  const canAct = !!room && room.phase === "playing" && !!me && !me.done && !me.eliminated;
  const myHand = me && me.hands.length > 0 ? me.hands[me.activeHand] : [];
  const myHandLen = myHand.length;
  const canDouble = canAct && myHandLen === 2;
  const canSplit = canAct && me!.hands.length === 1 && myHandLen === 2 && myHand[0]!.rank === myHand[1]!.rank;
  const canGift = !!room && room.phase === "playing" && !!me && (room.mode === "coop" || room.mode === "race");
  const giftable = room?.players.filter((p) => p.playerId !== playerId && !p.eliminated) ?? [];

  const gift = useCallback(
    (targetId: string, supportId: SupportId) => {
      if (!giftTarget || !targetId) return;
      action("gift", { targetId, supportId });
    },
    [giftTarget, action],
  );

  return (
    <div className="mp-root" style={{ minHeight: "100dvh", width: "100%", padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{mpStyles}</style>
      <div className="mp-wrap">
        <div className="mp-topbar">
          <button className="mp-btn mp-btn-ghost" onClick={leave}>← Back</button>
          <div className="mp-logo">ROGUELIKE BLACKJACK · MULTIPLAYER</div>
          <div style={{ width: 70 }} />
        </div>

        {!room ? (
          <div className="mp-panel">
            <div className="mp-title">Multiplayer Table</div>
            <p className="mp-muted">Create a room or join a friend. Up to 4 players share a run against the house. Help teammates with support powerups; XP from the level you reach is split among survivors.</p>

            <label className="mp-label">Your name</label>
            <input className="mp-input" value={username} maxLength={24} placeholder="Player" onChange={(e) => setUsername(e.target.value)} />

            <label className="mp-label">Game mode</label>
            <div className="mp-modes">
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <button key={m} className={`mp-mode ${mode === m ? "mp-mode-active" : ""}`} onClick={() => setMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="mp-row">
              <button className="mp-btn mp-btn-primary" disabled={busy} onClick={createRoom}>Create Room</button>
            </div>

            <div className="mp-divider">or join with a code</div>

            <label className="mp-label">Room code</label>
            <input className="mp-input mp-code" value={joinCode} maxLength={6} placeholder="ABC123" onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />

            <div className="mp-row">
              <button className="mp-btn mp-btn-secondary" disabled={busy} onClick={joinRoom}>Join Room</button>
            </div>
          </div>
        ) : (
          <div className="mp-panel">
            <div className="mp-room-head">
              <div>
                <div className="mp-room-label">Room code</div>
                <div className="mp-room-code">{room.code}</div>
              </div>
              <div>
                <div className="mp-room-label">Mode</div>
                <div className="mp-room-code mp-mode-badge">{MODE_LABELS[room.mode]}</div>
              </div>
              <div>
                <div className="mp-room-label">Players</div>
                <div className="mp-room-code">{room.players.length} / 4</div>
              </div>
              <div>
                <div className="mp-room-label">Level</div>
                <div className="mp-room-code">{room.round || "—"}</div>
              </div>
            </div>

            {room.runEnded && room.xp ? (
              <div className="mp-xp">
                <div className="mp-section-title">XP Earned</div>
                {room.xp.map((a) => (
                  <div key={a.playerId} className="mp-xp-row">
                    <b>{a.username}</b>
                    <span className="mp-xp-amount">+{a.amount} XP</span>
                  </div>
                ))}
                <div className="mp-row" style={{ justifyContent: "center", marginTop: 16 }}>
                  {room.hostId === playerId ? (
                    <button className="mp-btn mp-btn-primary" onClick={() => action("reset")}>New Run</button>
                  ) : (
                    <span className="mp-muted">Waiting for the host to start a new run…</span>
                  )}
                </div>
              </div>
            ) : room.phase === "lobby" ? (
              <div className="mp-lobby">
                <div className="mp-lobby-list">
                  {room.players.map((p) => (
                    <div key={p.playerId} className="mp-lobby-player">
                      <span className="mp-dot" />
                      <b>{p.username}</b>
                      {p.playerId === room.hostId ? <span className="mp-host">host</span> : null}
                      {p.eliminated ? <span className="mp-out">out</span> : null}
                    </div>
                  ))}
                </div>
                <p className="mp-muted">{room.players.length < 2 ? "Waiting for players to join…" : "Ready to play."}</p>
                {room.hostId === playerId ? (
                  <button className="mp-btn mp-btn-primary" onClick={() => action("deal")}>Deal</button>
                ) : (
                  <p className="mp-muted">Waiting for the host to deal…</p>
                )}
              </div>
            ) : (
              <>
                <div className="mp-dealer">
                  <div className="mp-role-label">House</div>
                  <div className="mp-cards">
                    {room.dealer.map((c, i) => {
                      const hidden = room.phase === "playing" && i === 1;
                      return (
                        <div key={i} className={`mp-card${hidden ? " mp-card-hidden" : ""}`} style={{ color: hidden ? undefined : cardColor(c) }}>
                          {hidden ? <span className="mp-card-back">✦</span> : (<><span className="mp-card-rank">{c.rank}</span><span className="mp-card-suit">{c.suit}</span></>)}
                        </div>
                      );
                    })}
                  </div>
                  {room.phase === "reveal" ? <div className="mp-dealer-total">House total: {computeHandValue(room.dealer)}</div> : null}
                </div>

                {others.length > 0 ? (
                  <div className="mp-others">
                    {others.map((p) => (
                      <div key={p.playerId} className="mp-other" style={{ opacity: p.eliminated ? 0.35 : 1 }}>
                        <div className="mp-other-name">{p.username}{p.eliminated ? " (out)" : ""}</div>
                        <div className="mp-cards" style={{ transform: `scale(${otherScale})`, transformOrigin: "top center" }}>
                          {p.hands.length > 0 ? (
                            p.hands[p.activeHand].map((c, i) => (
                              <div key={i} className="mp-card mp-card-sm" style={{ color: cardColor(c) }}>
                                <span className="mp-card-rank">{c.rank}</span>
                                <span className="mp-card-suit">{c.suit}</span>
                              </div>
                            ))
                          ) : (
                            <span className="mp-muted">—</span>
                          )}
                        </div>
                        {room.phase === "reveal" && p.results.length > 0 ? (
                          <div className="mp-other-result" style={{ color: outcomeColor(p.outcomes[p.activeHand] ?? null) }}>
                            {outcomeLabel(p.outcomes[p.activeHand] ?? null)}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mp-you" style={{ opacity: me?.eliminated ? 0.35 : 1 }}>
                  <div className="mp-role-label">You{me && me.eliminated ? " (eliminated)" : ""}{me && me.hands.length > 1 ? ` (hand ${me.activeHand + 1} of 2)` : ""}</div>
                  {myHandLen > 0 ? (
                    <>
                      <div className="mp-your-value">{computeHandValue(myHand) + (me?.handBonuses[me.activeHand] ?? 0)}</div>
                      <div className="mp-cards">
                        {myHand.map((c, i) => (
                          <div key={i} className="mp-card" style={{ color: cardColor(c) }}>
                            <span className="mp-card-rank">{c.rank}</span>
                            <span className="mp-card-suit">{c.suit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mp-muted">Waiting…</div>
                  )}
                </div>

                {room.phase === "reveal" ? (
                  <div className="mp-actions">
                    {room.hostId === playerId ? (
                      <button className="mp-btn mp-btn-primary" onClick={() => action("next")}>Next Round</button>
                    ) : (
                      <div className="mp-muted">Waiting for the host to start the next round…</div>
                    )}
                  </div>
                ) : me && me.eliminated ? (
                  <div className="mp-actions">
                    <div className="mp-muted">You've been eliminated. Waiting for the run to end…</div>
                  </div>
                ) : me && me.done ? (
                  <div className="mp-actions">
                    <div className="mp-muted">Waiting for other players…</div>
                  </div>
                ) : (
                  <div className="mp-actions">
                    <button className="mp-btn mp-btn-primary" disabled={!canAct} onClick={() => action("hit")}>Hit</button>
                    <button className="mp-btn mp-btn-secondary" disabled={!canAct} onClick={() => action("stand")}>Stand</button>
                    {canDouble ? <button className="mp-btn mp-btn-double" onClick={() => action("double")}>Double</button> : null}
                    {canSplit ? <button className="mp-btn mp-btn-split" onClick={() => action("split")}>Split</button> : null}
                  </div>
                )}

                {canGift && giftable.length > 0 ? (
                  <div className="mp-gift">
                    <div className="mp-section-title">Gift a support powerup</div>
                    <div className="mp-gift-row">
                      <select className="mp-input mp-gift-select" value={giftTarget ?? ""} onChange={(e) => setGiftTarget(e.target.value)}>
                        <option value="">Choose teammate…</option>
                        {giftable.map((p) => (
                          <option key={p.playerId} value={p.playerId}>{p.username}</option>
                        ))}
                      </select>
                      {giftTarget ? (
                        <div className="mp-gift-powerups">
                          {(Object.keys(SUPPORT_LABELS) as SupportId[]).map((s) => (
                            <button
                              key={s}
                              className="mp-btn mp-btn-ghost"
                              disabled={(me?.support[s] ?? 0) <= 0}
                              onClick={() => gift(giftTarget, s)}
                            >
                              {SUPPORT_LABELS[s]} (×{me?.support[s] ?? 0})
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {toast ? <div className="mp-toast">{toast}</div> : null}
    </div>
  );
}

const mpStyles = `
  .mp-root { background: radial-gradient(1200px 700px at 50% -10%, rgba(168,85,247,.22), transparent 60%), radial-gradient(900px 500px at 100% 110%, rgba(56,189,248,.14), transparent 60%), linear-gradient(#06060d, #0a0a14); color: #eaf6ff; overflow-x: hidden; }
  .mp-wrap { max-width: 820px; margin: 0 auto; }
  .mp-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .mp-logo { font-size: 15px; font-weight: 900; letter-spacing: .14em; color: #fff; text-shadow: 0 0 18px rgba(168,85,247,.6); }
  .mp-panel { border: 1px solid rgba(255,255,255,.1); border-radius: 22px; background: rgba(255,255,255,.03); padding: 24px; }
  .mp-title { font-size: 26px; font-weight: 900; margin-bottom: 6px; }
  .mp-muted { color: rgba(255,255,255,.55); font-size: 13px; line-height: 1.6; }
  .mp-label { display: block; margin-top: 16px; margin-bottom: 6px; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.6); }
  .mp-input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.05); color: #fff; font-size: 15px; box-sizing: border-box; }
  .mp-code { text-transform: uppercase; letter-spacing: .2em; font-weight: 700; }
  .mp-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .mp-divider { margin: 20px 0 4px; color: rgba(255,255,255,.4); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
  .mp-modes { display: flex; gap: 8px; margin-top: 8px; }
  .mp-mode { flex: 1; padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.05); color: #fff; cursor: pointer; font-weight: 700; }
  .mp-mode-active { border-color: rgba(168,85,247,.8); background: rgba(168,85,247,.18); }
  .mp-btn { border: none; border-radius: 12px; padding: 11px 18px; font-size: 14px; font-weight: 700; cursor: pointer; transition: .15s; }
  .mp-btn:disabled { opacity: .35; cursor: not-allowed; }
  .mp-btn-primary { background: linear-gradient(90deg, #38bdf8, #a855f7); color: #05070f; }
  .mp-btn-secondary { background: rgba(255,255,255,.1); color: #fff; border: 1px solid rgba(255,255,255,.15); }
  .mp-btn-ghost { background: transparent; color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,.15); }
  .mp-btn-double { background: linear-gradient(90deg, #ffd24a, #ff9d4a); color: #2a1605; }
  .mp-btn-split { background: linear-gradient(90deg, #4de3c1, #38bdf8); color: #03231a; }
  .mp-room-head { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .mp-room-head > div { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 12px; text-align: center; }
  .mp-room-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .mp-room-code { font-size: 24px; font-weight: 900; color: #fff; letter-spacing: .08em; }
  .mp-mode-badge { font-size: 16px; color: #ffd24a; }
  .mp-lobby { text-align: center; }
  .mp-lobby-list { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin: 14px 0; }
  .mp-lobby-player { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 10px 14px; font-size: 14px; }
  .mp-dot { width: 8px; height: 8px; border-radius: 50%; background: #4de3c1; box-shadow: 0 0 8px rgba(77,227,193,.8); }
  .mp-host { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #ffd24a; }
  .mp-out { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #ff5d8f; }
  .mp-section-title { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); margin-bottom: 10px; }
  .mp-dealer, .mp-you { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 18px; }
  .mp-role-label { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .mp-dealer-total { font-size: 13px; color: rgba(255,255,255,.7); }
  .mp-cards { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .mp-card { width: 72px; height: 104px; border-radius: 12px; background: linear-gradient(160deg, #161d2e 0%, #0a0e18 55%); border: 2px solid rgba(255,255,255,.18); box-shadow: 0 8px 24px rgba(0,0,0,.5); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; position: relative; overflow: hidden; }
  .mp-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, rgba(255,255,255,.14) 0%, transparent 42%); pointer-events: none; }
  .mp-card-rank { font-size: 26px; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
  .mp-card-suit { font-size: 26px; line-height: 1; }
  .mp-card-hidden { border-color: rgba(168,85,247,.45) !important; background: repeating-linear-gradient(45deg, #141a2b, #141a2b 6px, #0c1020 6px, #0c1020 12px) !important; }
  .mp-card-back { font-size: 22px; color: rgba(168,85,247,.8); }
  .mp-others { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-bottom: 18px; }
  .mp-other { text-align: center; }
  .mp-other-name { font-size: 12px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 4px; }
  .mp-other-result { font-size: 13px; font-weight: 800; margin-top: 4px; }
  .mp-your-value { font-size: 26px; font-weight: 900; color: #fff; text-shadow: 0 0 16px rgba(168,85,247,.45); }
  .mp-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 20px; align-items: center; }
  .mp-gift { margin-top: 20px; border-top: 1px solid rgba(255,255,255,.1); padding-top: 16px; }
  .mp-gift-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .mp-gift-select { width: auto; min-width: 180px; }
  .mp-gift-powerups { display: flex; gap: 8px; flex-wrap: wrap; }
  .mp-xp { text-align: center; padding: 20px; }
  .mp-xp-row { display: flex; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .mp-xp-amount { color: #ffd24a; font-weight: 800; }
  .mp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(10,14,24,.95); border: 1px solid rgba(168,85,247,.4); color: #fff; border-radius: 14px; padding: 12px 18px; font-size: 14px; font-weight: 600; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
  @media (max-width: 640px) {
    .mp-room-head { grid-template-columns: repeat(2, 1fr); }
    .mp-card { width: 60px; height: 86px; }
    .mp-card-rank, .mp-card-suit { font-size: 22px; }
  }
`;
