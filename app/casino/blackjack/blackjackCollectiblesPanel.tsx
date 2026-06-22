"use client";

export function blackjackCollectibleLabel(key: string) {
  const map: Record<string, string> = { SODA_CUP: "🥤", CHICKEN_WING: "🍗", FRIES: "🍟", DICE: "🎲" };
  return map[key] ?? key;
}

type Figurine = { id: string; imageUrl: string };

export function BlackjackCollectiblesPanel({
  open,
  tableEditMode,
  bonusPointsBalance,
  allInWinStreak,
  newFigOpen,
  newFigUrl,
  newFigBusy,
  ownedCollectibles,
  figurines,
  onClose,
  onEnterTableEdit,
  onOpenNewFig,
  onCloseNewFig,
  onChangeNewFigUrl,
  onCreateFigurine,
  onSellEmoji,
  onSellFigurine,
}: {
  open: boolean;
  tableEditMode: boolean;
  bonusPointsBalance: number;
  allInWinStreak: number;
  newFigOpen: boolean;
  newFigUrl: string;
  newFigBusy: boolean;
  ownedCollectibles: Record<string, number>;
  figurines: Figurine[];
  onClose: () => void;
  onEnterTableEdit: () => void;
  onOpenNewFig: () => void;
  onCloseNewFig: () => void;
  onChangeNewFigUrl: (value: string) => void;
  onCreateFigurine: () => Promise<void>;
  onSellEmoji: (key: string) => Promise<void>;
  onSellFigurine: (figurineId: string) => Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
      <div className="glass glass-shine w-full max-w-[560px] rounded-3xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Collectibles</div>
            <div className="mt-1 text-xs text-white/60">Place items on the felt and drag them in edit mode.</div>
            <div className="mt-1 text-[11px] text-white/55">
              Bonus points: <span className="font-mono text-white/80">{bonusPointsBalance}</span>
              {allInWinStreak > 0 ? (
                <>
                  {" "}
                  • All-in win streak: <span className="font-mono text-white/80">{allInWinStreak}</span>
                </>
              ) : null}
            </div>
          </div>
          <button type="button" className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-2xl border px-3 py-2 text-xs ${
              tableEditMode ? "border-yellow-300/25 bg-yellow-500/10 text-yellow-100" : "border-white/10 bg-white/5 text-white/70 hover:text-white"
            }`}
            onClick={onEnterTableEdit}
          >
            Enter table edit
          </button>
          <button
            type="button"
            disabled={bonusPointsBalance < 20}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
            onClick={onOpenNewFig}
            title="Costs 20 bonus points"
          >
            Buy Custom Figurine (20 BP)
          </button>
        </div>

        {newFigOpen ? (
          <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-white/80">Custom figurine (PNG)</div>
            <div className="mt-1 text-[11px] leading-5 text-white/60">
              Paste a <span className="font-mono">https://... .png</span> URL. This will spend <span className="font-mono">20</span> bonus points.
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={newFigUrl}
                onChange={(e) => onChangeNewFigUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                  onClick={onCloseNewFig}
                  disabled={newFigBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newFigUrl.trim() || newFigBusy}
                  className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-40"
                  onClick={() => void onCreateFigurine()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-white/80">Emoji items</div>
            <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(90px,1fr))]">
              {Object.entries(ownedCollectibles)
                .filter(([, v]) => Number(v) > 0)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-[11px] text-white/80"
                    title="Use Table Edit Mode to place"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg">{blackjackCollectibleLabel(k)}</div>
                      <div className="font-mono text-white/60">{v}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-white/45">Sell +5 BP</div>
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/10"
                        onClick={() => void onSellEmoji(k)}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                ))}
              {Object.values(ownedCollectibles).every((v) => Number(v) <= 0) ? <div className="text-xs text-white/50">No emoji collectibles yet.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-semibold text-white/80">Figurines</div>
            <div className="mt-3 grid gap-2">
              {figurines.length ? (
                figurines.map((f) => (
                  <div key={f.id} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-[11px] text-white/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img src={f.imageUrl} alt="" className="h-8 w-8 rounded-lg border border-white/10 object-cover" />
                        <div className="text-white/70">Figurine</div>
                      </div>
                      <div className="font-mono text-white/45">{f.id.slice(0, 4)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-white/45">Sell +15 BP</div>
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/10"
                        onClick={() => void onSellFigurine(f.id)}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-white/50">No figurines yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/50">Tip: enter Table Edit Mode to place and move items.</div>
      </div>
    </div>
  );
}

export function BlackjackTableEditInventory({
  open,
  ownedCollectibles,
  figurines,
  onExit,
  onOpenInventory,
  onPlaceEmoji,
  onPlaceFigurine,
}: {
  open: boolean;
  ownedCollectibles: Record<string, number>;
  figurines: Figurine[];
  onExit: () => void;
  onOpenInventory: () => void;
  onPlaceEmoji: (key: string) => Promise<void>;
  onPlaceFigurine: (figurineId: string) => Promise<void>;
}) {
  if (!open) return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-4 z-[75]">
        <button
          type="button"
          className="pointer-events-auto glass glass-shine rounded-3xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-3 text-left text-xs text-yellow-100 hover:bg-yellow-500/15"
          onClick={onExit}
          title="Exit table edit mode"
        >
          <div className="font-semibold">Table Edit</div>
          <div className="mt-1 text-[11px] text-yellow-100/70">Tap to exit</div>
        </button>
      </div>

      <div className="pointer-events-none fixed right-3 top-28 z-[75] w-[220px] max-w-[48vw]">
        <div className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-white/85">Collectibles</div>
            <button
              type="button"
              className="rounded-2xl px-2 py-1 text-[11px] text-white/60 hover:text-white"
              onClick={onOpenInventory}
              title="Open full inventory"
            >
              +
            </button>
          </div>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="text-[11px] font-semibold text-white/60">Emoji</div>
            <div className="mt-2 grid gap-2">
              {Object.entries(ownedCollectibles)
                .filter(([, v]) => Number(v) > 0)
                .map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-white/80 hover:bg-white/10"
                    onClick={() => void onPlaceEmoji(k)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base">{blackjackCollectibleLabel(k)}</div>
                      <div className="font-mono text-white/60">{v}</div>
                    </div>
                  </button>
                ))}
              {Object.values(ownedCollectibles).every((v) => Number(v) <= 0) ? <div className="text-xs text-white/45">No emoji items.</div> : null}
            </div>

            <div className="mt-4 text-[11px] font-semibold text-white/60">Figurines</div>
            <div className="mt-2 grid gap-2">
              {figurines.length ? (
                figurines.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-white/80 hover:bg-white/10"
                    onClick={() => void onPlaceFigurine(f.id)}
                  >
                    <div className="flex items-center gap-2">
                      <img src={f.imageUrl} alt="" className="h-8 w-8 rounded-lg border border-white/10 object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-white/80">Figurine</div>
                        <div className="font-mono text-[10px] text-white/45">{f.id.slice(0, 6)}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-white/45">No figurines.</div>
              )}
            </div>
          </div>
          <div className="mt-3 text-[10px] text-white/45">Drag items on the felt to move. Tap × to return to inventory.</div>
        </div>
      </div>
    </>
  );
}
