"use client";

import Link from "next/link";

export function BlackjackInviteModal({
  open,
  inviteUrl,
  inviteCopied,
  onClose,
  onCopy,
  onOpenLink,
}: {
  open: boolean;
  inviteUrl: string;
  inviteCopied: boolean;
  onClose: () => void;
  onCopy: () => Promise<void>;
  onOpenLink: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
      <div className="glass glass-shine w-full max-w-[620px] rounded-3xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Invite players</div>
            <div className="mt-1 text-xs text-white/60">Share this link to join the room:</div>
          </div>
          <button type="button" className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <a
            href={inviteUrl || "#"}
            className="break-all font-mono text-xs text-white/85 underline decoration-white/20 underline-offset-4 hover:text-white"
            onClick={(e) => {
              if (!inviteUrl) e.preventDefault();
            }}
          >
            {inviteUrl || "(loading…)"}
          </a>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/85 hover:bg-white/10 disabled:opacity-40"
              disabled={!inviteUrl}
              onClick={() => void onCopy()}
            >
              {inviteCopied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10"
              onClick={onOpenLink}
              disabled={!inviteUrl}
            >
              Open link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlackjackTableHeader({
  visible,
  tableName,
  tableId,
  round,
  phase,
  err,
  onOpenInvite,
  onLeave,
}: {
  visible: boolean;
  tableName: string;
  tableId: string;
  round: number;
  phase: string;
  err?: string | null;
  onOpenInvite: () => void;
  onLeave: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="glass glass-shine rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{tableName || "Blackjack Table"}</h2>
          <p className="mt-1 text-sm text-white/60">
            Table: <span className="font-mono">{tableId || "-"}</span> • Round <span className="font-mono">{round || "-"}</span> • Phase{" "}
            <span className="font-mono">{phase || "-"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/casino/blackjack" className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10">
            Back to lobby
          </Link>
          <button
            type="button"
            className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            onClick={onOpenInvite}
            title="Share a link to join this table"
          >
            Invite players
          </button>
          <button type="button" className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
      {err ? <div className="mt-3 text-sm text-rose-200">{err}</div> : null}
    </div>
  );
}

export function BlackjackTurnActionBar({
  visible,
  myHandIndex,
  myHandCount,
  turnLeft,
  canDoubleDown,
  canSplit,
  extendUsed,
  busted,
  onHit,
  onStand,
  onDoubleDown,
  onSplit,
  onVoteSkip,
  onExtend,
}: {
  visible: boolean;
  myHandIndex: number;
  myHandCount: number;
  turnLeft: number;
  canDoubleDown: boolean;
  canSplit: boolean;
  extendUsed: boolean;
  busted: boolean;
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  onSplit: () => void;
  onVoteSkip: () => void;
  onExtend: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="sticky top-3 z-[60]">
      <div className="glass glass-shine rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">
            Your turn
            {myHandCount > 1 ? (
              <span className="ml-2 text-xs font-medium text-white/70">
                (Hand {myHandIndex + 1}/{myHandCount})
              </span>
            ) : null}
          </div>
          <div className="text-xs text-white/70">
            Time: <span className="font-mono text-white/85">{turnLeft}s</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
            onClick={onHit}
            disabled={busted}
          >
            Hit
          </button>
          <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10" onClick={onStand}>
            Stand
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
            onClick={onDoubleDown}
            disabled={!canDoubleDown}
            title="Double your bet, draw one card, and stand"
          >
            DD
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
            onClick={onSplit}
            disabled={!canSplit}
            title="Split (up to 4 hands). If your cards don't match, requires FREE_SPLIT."
          >
            Split
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
            onClick={onVoteSkip}
            title="Skip the remaining turn timer"
          >
            Vote skip
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
            onClick={onExtend}
            disabled={extendUsed}
            title="Extend your turn timer once"
          >
            Extend timer
          </button>
        </div>
      </div>
    </div>
  );
}
