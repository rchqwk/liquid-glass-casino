"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type MockSeat = {
  name: string;
  side: "left" | "right";
  bet: number;
  total: number;
  status?: string;
  badges?: string[];
  cards: Array<{ r: string; s: string }>;
};

type Step = {
  title: string;
  body: string;
  focus?: "bet" | "specials" | "boxes" | "collectibles" | "chat" | "table";
  scene: {
    phaseLabel: string;
    dealer: { totalLabel: string; cards: Array<{ r: string; s: string }> };
    seats: MockSeat[];
    banner?: { tone: "good" | "warn" | "bad"; text: string };
    specials: Array<{ id: string; label: string; why: string }>;
  };
};

function Card({ r, s, hidden }: { r: string; s: string; hidden?: boolean }) {
  // Style match (roughly) with the real blackjack CardView.
  const isHidden = hidden || r === "?" || s === "?";
  if (isHidden) {
    return (
      <div className="relative flex h-20 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      </div>
    );
  }
  const isRed = s === "♥" || s === "♦";
  return (
    <div className="relative flex h-20 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
      <div className={`absolute left-2 top-2 text-[10px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {r}
        <div className="text-[9px] leading-3">{s}</div>
      </div>
      <div className={`text-xl ${isRed ? "text-rose-600" : "text-zinc-900"}`}>{s}</div>
      <div
        className={`absolute bottom-2 right-2 rotate-180 text-[10px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}
      >
        {r}
        <div className="text-[9px] leading-3">{s}</div>
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const cls =
    tone === "good"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
        : tone === "bad"
          ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
          : "border-white/10 bg-black/20 text-white/80";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export default function TutorialPage() {
  const steps = useMemo<Step[]>(
    () => [
      {
        title: "Welcome to Arcade Blackjack",
        body:
          "This is a safe, simulated table. Use Next/Back to walk through betting, powerups, mystery boxes, and collectibles with fake players.",
        focus: "table",
        scene: {
          phaseLabel: "Betting (25s left)",
          dealer: { totalLabel: "Visible 6", cards: [{ r: "6", s: "♣" }, { r: "?", s: "?" }] },
          seats: [
            { name: "You", side: "left", bet: 10, total: 12, cards: [{ r: "7", s: "♦" }, { r: "5", s: "♠" }] },
            { name: "Luna", side: "right", bet: 5, total: 18, cards: [{ r: "K", s: "♥" }, { r: "8", s: "♣" }] },
            { name: "Ace", side: "left", bet: 12, total: 16, cards: [{ r: "9", s: "♠" }, { r: "7", s: "♥" }] },
            { name: "Nova", side: "right", bet: 8, total: 20, cards: [{ r: "Q", s: "♦" }, { r: "10", s: "♠" }] },
          ],
          banner: { tone: "warn", text: "Betting phase: place your bet before the timer ends." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Improve your total (e.g. +1/+2)." },
            { id: "saves", label: "Saves", why: "Fix a bust or bad draw (e.g. -1/-2/-5)." },
            { id: "utility", label: "Utility", why: "Peek/swap/control the situation." },
          ],
        },
      },
      {
        title: "Betting & timers",
        body:
          "Rounds start with a betting countdown. Lock in your wager (or go All-in) before the timer hits 0. If you change your mind, clear the bet before betting closes.",
        focus: "bet",
        scene: {
          phaseLabel: "Betting (9s left)",
          dealer: { totalLabel: "Visible 6", cards: [{ r: "6", s: "♣" }, { r: "?", s: "?" }] },
          seats: [
            { name: "You", side: "left", bet: 25, total: 0, badges: ["ALL-IN"], cards: [] },
            { name: "Luna", side: "right", bet: 5, total: 0, cards: [] },
            { name: "Ace", side: "left", bet: 12, total: 0, cards: [] },
            { name: "Nova", side: "right", bet: 8, total: 0, cards: [] },
          ],
          banner: { tone: "warn", text: "All-in is useful when you want the max stake instantly." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Great when you’re close to 21." },
            { id: "saves", label: "Saves", why: "Hold for when you bust or draw badly." },
            { id: "utility", label: "Utility", why: "Peek / swap / remove to swing odds." },
          ],
        },
      },
      {
        title: "Boost powerups (win context)",
        body:
          "Boosts help you turn a ‘good’ hand into a ‘winning’ hand. Example: you’re on 19 and use +2 to hit 21.",
        focus: "specials",
        scene: {
          phaseLabel: "Player turns",
          dealer: { totalLabel: "Visible 10", cards: [{ r: "10", s: "♠" }, { r: "?", s: "?" }] },
          seats: [
            {
              name: "You",
              side: "left",
              bet: 25,
              total: 21,
              badges: ["BOOST +2"],
              cards: [
                { r: "9", s: "♥" },
                { r: "K", s: "♦" },
                { r: "+2", s: "★" },
              ],
            },
            { name: "Luna", side: "right", bet: 5, total: 18, cards: [{ r: "K", s: "♥" }, { r: "8", s: "♣" }] },
            { name: "Ace", side: "left", bet: 12, total: 16, cards: [{ r: "9", s: "♠" }, { r: "7", s: "♥" }] },
            { name: "Nova", side: "right", bet: 8, total: 20, cards: [{ r: "Q", s: "♦" }, { r: "10", s: "♠" }] },
          ],
          banner: { tone: "good", text: "Boost used: +2 → 21. Now you’re in a great spot to win." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Use when close to 21 to lock wins." },
            { id: "saves", label: "Saves", why: "Not needed here—save them for busts." },
            { id: "utility", label: "Utility", why: "Use to fix a specific threat or bad draw." },
          ],
        },
      },
      {
        title: "Save powerups (lose → recover)",
        body:
          "Saves are best when you would otherwise lose immediately. Example: you bust at 22, then use -1 to drop back to 21.",
        focus: "specials",
        scene: {
          phaseLabel: "Player turns",
          dealer: { totalLabel: "Visible 10", cards: [{ r: "10", s: "♠" }, { r: "?", s: "?" }] },
          seats: [
            {
              name: "You",
              side: "left",
              bet: 25,
              total: 21,
              badges: ["SAVE -1"],
              status: "Recovered",
              cards: [
                { r: "9", s: "♥" },
                { r: "K", s: "♦" },
                { r: "4", s: "♣" },
                { r: "-1", s: "★" },
              ],
            },
            { name: "Luna", side: "right", bet: 5, total: 18, cards: [{ r: "K", s: "♥" }, { r: "8", s: "♣" }] },
            { name: "Ace", side: "left", bet: 12, total: 16, cards: [{ r: "9", s: "♠" }, { r: "7", s: "♥" }] },
            { name: "Nova", side: "right", bet: 8, total: 20, cards: [{ r: "Q", s: "♦" }, { r: "10", s: "♠" }] },
          ],
          banner: { tone: "good", text: "Save used: -1 turned a bust into 21. Massive swing." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Use when you’re close but not busted." },
            { id: "saves", label: "Saves", why: "Use when you bust or are about to lose badly." },
            { id: "utility", label: "Utility", why: "Use to peek/swap/remove when you need control." },
          ],
        },
      },
      {
        title: "Mystery boxes",
        body:
          "Mystery boxes give random specials. Open them to build your inventory, then use the right powerup at the right time.",
        focus: "boxes",
        scene: {
          phaseLabel: "Between rounds",
          dealer: { totalLabel: "—", cards: [] },
          seats: [
            { name: "You", side: "left", bet: 0, total: 0, badges: ["BOX +1"], cards: [] },
            { name: "Luna", side: "right", bet: 0, total: 0, cards: [] },
            { name: "Ace", side: "left", bet: 0, total: 0, cards: [] },
            { name: "Nova", side: "right", bet: 0, total: 0, cards: [] },
          ],
          banner: { tone: "warn", text: "Open boxes between hands to stay stocked on powerups." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Common and consistently useful." },
            { id: "saves", label: "Saves", why: "Rare lifesavers—keep at least one." },
            { id: "utility", label: "Utility", why: "Great when you need information/control." },
          ],
        },
      },
      {
        title: "Collectibles",
        body:
          "Collectibles are cosmetic items you place on the felt. You can move them around and they persist across tables. (Max 4 placed at once per player.)",
        focus: "collectibles",
        scene: {
          phaseLabel: "Table edit mode",
          dealer: { totalLabel: "—", cards: [] },
          seats: [
            { name: "You", side: "left", bet: 0, total: 0, badges: ["🥤 🍟 🎲 🍗"], cards: [] },
            { name: "Luna", side: "right", bet: 0, total: 0, cards: [] },
            { name: "Ace", side: "left", bet: 0, total: 0, cards: [] },
            { name: "Nova", side: "right", bet: 0, total: 0, cards: [] },
          ],
          banner: { tone: "good", text: "Collectibles are just for style—decorate your table." },
          specials: [
            { id: "boosts", label: "Boosts", why: "Gameplay advantage." },
            { id: "saves", label: "Saves", why: "Gameplay advantage." },
            { id: "utility", label: "Utility", why: "Gameplay advantage." },
          ],
        },
      },
    ],
    [],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx]!;

  const focusClass = (key: Step["focus"]) =>
    step.focus === key ? "ring-2 ring-emerald-300/60 drop-shadow-[0_0_24px_rgba(52,211,153,.12)]" : "ring-1 ring-white/10";

  const panelInner = (
    <>
      <div className="text-xs font-semibold text-white/60">
        Step {stepIdx + 1}/{steps.length}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{step.title}</div>
      <div className="mt-2 text-sm leading-6 text-white/70">{step.body}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/casino/blackjack/rules"
          target="_blank"
          className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
        >
          Blackjack rules
        </Link>
        <Link
          href="/casino/blackjack/special-rules"
          target="_blank"
          className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
        >
          Special rules
        </Link>
        <Link
          href="/casino/blackjack/strategy"
          target="_blank"
          className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
        >
          Strategy guide
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-40"
          disabled={stepIdx === 0}
          onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
        >
          Back
        </button>
        {stepIdx >= steps.length - 1 ? (
          <Link
            href="/casino/blackjack-v2"
            className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
          >
            Enter lobby
          </Link>
        ) : (
          <button
            type="button"
            className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
            onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))}
          >
            Next
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="glass glass-shine rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Tutorial</h1>
            <p className="mt-1 text-sm text-white/60">A simulated table with fake players (no real betting).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
              Back to home
            </Link>
            <Link
              href="/casino"
              className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              Back to casino
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile: floating tutorial bubble */}
      <div className="lg:hidden">
        <div className={`fixed inset-x-3 bottom-3 z-[70] max-h-[46vh] overflow-auto glass-soft glass-shine rounded-3xl p-5 ${focusClass("table")}`}>
          {panelInner}
        </div>
        <div className="h-[320px]" />
      </div>

      <div className="relative">
        {/* Desktop: floating tutorial bubble pinned to the bottom-right */}
        <div
          className={`hidden lg:block fixed bottom-4 right-4 z-[70] w-[380px] max-h-[min(460px,calc(100dvh-2rem))] overflow-auto glass-soft glass-shine rounded-3xl p-5 ${focusClass("table")}`}
        >
          {panelInner}
        </div>

        {/* Everything below should match the normal blackjack layout (controls left, table right).
            The tutorial bubble floats above it on desktop. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          {/* Left column: mock controls (in the usual place) */}
          <div className="glass-soft glass-shine rounded-3xl p-5">
            <p className="text-sm font-medium text-white">Round controls</p>
            <div className="mt-3 text-xs text-white/60">{step.scene.phaseLabel}</div>
            <div className={`mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 ${focusClass("bet")}`}>
              <div className="text-xs font-semibold text-white/70">Betting</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Balance: <span className="font-mono text-white/85">123.45 ⓒ</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Bet: <span className="font-mono text-white/85">{(step.scene.seats[0]?.bet ?? 0).toFixed(2)} ⓒ</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/70">
                  Place bet
                </span>
                <span className="rounded-2xl border border-yellow-300/25 bg-yellow-500/10 px-3 py-2 text-[11px] font-semibold text-yellow-100">
                  All in
                </span>
                <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/70">
                  Clear bet
                </span>
              </div>
            </div>

            <div className={`mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 ${focusClass("specials")}`}>
              <div className="text-xs font-semibold text-white/70">Specials</div>
              <div className="mt-2 space-y-2">
                {step.scene.specials.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-white/85">{s.label}</div>
                      <div className="text-[11px] text-white/45">x2</div>
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-white/60">{s.why}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 ${focusClass("boxes")}`}>
              <div className="text-xs font-semibold text-white/70">Mystery Boxes</div>
              <div className="mt-2 text-[11px] text-white/60">
                Unopened: <span className="font-mono text-white/85">3</span>
              </div>
            </div>

            <div className={`mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 ${focusClass("collectibles")}`}>
              <div className="text-xs font-semibold text-white/70">Collectibles</div>
              <div className="mt-2 text-[11px] text-white/60">Place items on the felt (max 4 placed).</div>
            </div>

            <div className={`mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 ${focusClass("chat")}`}>
              <div className="text-xs font-semibold text-white/70">Chat</div>
              <div className="mt-2 text-[11px] text-white/60">Coordinate with players / call shots.</div>
            </div>
          </div>

          {/* Right column: table (positions/sizing match the real table view) */}
          <div className="glass-soft glass-shine rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Table</div>
              <Pill tone="neutral">{step.scene.phaseLabel}</Pill>
            </div>

            {step.scene.banner ? (
              <div
                className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
                  step.scene.banner.tone === "good"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : step.scene.banner.tone === "bad"
                      ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-100"
                }`}
              >
                {step.scene.banner.text}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="relative mx-auto w-full max-w-[640px]">
                <div className="mx-auto h-[560px] w-full rounded-[48px] border border-white/10 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-black/25 shadow-[0_40px_120px_rgba(0,0,0,.45)]" />
                <div className="pointer-events-none absolute inset-0 rounded-[48px] ring-1 ring-white/10" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[480px] w-[320px] rounded-[999px] border border-white/10 bg-gradient-to-b from-emerald-500/12 to-black/20" />
                </div>

                {/* Dealer hand */}
                <div className="absolute left-1/2 top-8 w-[360px] -translate-x-1/2">
                  <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-white/80">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-semibold text-white/85">
                      Dealer
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-white/70">
                      {step.scene.dealer.totalLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {step.scene.dealer.cards.length ? (
                      <>
                        {step.scene.dealer.cards.map((c, i) => (
                          <Card key={i} r={c.r} s={c.s} hidden={c.r === "?" || c.s === "?"} />
                        ))}
                      </>
                    ) : (
                      <div className="text-xs text-white/40">No cards</div>
                    )}
                  </div>
                </div>

                {/* Seats on the sides (match in-game alternating layout) */}
                {(() => {
                  const leftTops = [92, 182, 272, 362, 452];
                  const rightTops = [104, 194, 284, 374, 464];
                  return step.scene.seats.map((p, i) => {
                    const isLeft = i % 2 === 0;
                    const rank = Math.floor(i / 2);
                    const topPx = isLeft ? leftTops[rank] ?? 452 : rightTops[rank] ?? 464;
                    return (
                      <div key={p.name} className={`absolute ${isLeft ? "left-4" : "right-4"} w-[260px]`} style={{ top: topPx }}>
                        <div className={`${step.focus === "table" ? "drop-shadow-[0_0_18px_rgba(52,211,153,.12)]" : ""}`}>
                          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/80">
                            <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 font-semibold text-white/85">
                              {p.name}
                            </span>
                            {p.badges?.map((b) => (
                              <span
                                key={b}
                                className="rounded-full border border-yellow-300/25 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-100"
                              >
                                {b}
                              </span>
                            ))}
                            {p.bet ? (
                              <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-white/70">
                                Bet <span className="font-mono text-white/80">{p.bet.toFixed(2)}</span>
                              </span>
                            ) : null}
                            {p.total ? (
                              <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-white/70">
                                <span className="font-mono text-white/85">{p.total}</span>
                              </span>
                            ) : null}
                            {p.status ? <span className="text-emerald-200">{p.status}</span> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.cards.length ? (
                              p.cards.map((c, idx) => <Card key={idx} r={c.r} s={c.s} />)
                            ) : (
                              <div className="text-xs text-white/35">—</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="mt-4 text-[11px] text-white/45">
              This is a visual clone for learning. To play for real, head to{" "}
              <Link className="text-white/70 underline" href="/casino/blackjack">
                Blackjack lobby
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
