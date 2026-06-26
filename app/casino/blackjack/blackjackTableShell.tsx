"use client";

import Link from "next/link";

export function BlackjackInviteModal({
  open,
  inviteUrl,
  inviteCopied,
  experience = "classic",
  onClose,
  onCopy,
  onOpenLink,
}: {
  open: boolean;
  inviteUrl: string;
  inviteCopied: boolean;
  experience?: "classic" | "v2";
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
            <div className="text-sm font-semibold text-white">{experience === "v2" ? "Share table" : "Invite players"}</div>
            <div className="mt-1 text-xs text-white/60">
              {experience === "v2" ? "Send this V2 table link so someone can jump straight into the surface:" : "Share this link to join the room:"}
            </div>
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
              {inviteCopied ? "Copied" : experience === "v2" ? "Copy invite" : "Copy link"}
            </button>
            <button
              type="button"
              className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10"
              onClick={onOpenLink}
              disabled={!inviteUrl}
            >
              {experience === "v2" ? "Open table" : "Open link"}
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
  joinCode,
  round,
  phase,
  lobbyHref,
  experience = "classic",
  err,
  showInvite = true,
  onOpenInvite,
  onLeave,
}: {
  visible: boolean;
  tableName: string;
  tableId: string;
  joinCode?: string | null;
  round: number;
  phase: string;
  lobbyHref: string;
  experience?: "classic" | "v2";
  err?: string | null;
  showInvite?: boolean;
  onOpenInvite: () => void;
  onLeave: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="glass glass-shine rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{tableName || (experience === "v2" ? "Blackjack Table" : "Blackjack Table")}</h2>
          <p className="mt-1 text-sm text-white/60">
            {experience === "v2" ? "Surface" : "Table"}: <span className="font-mono">{tableId || "-"}</span> • Round <span className="font-mono">{round || "-"}</span> • Phase{" "}
            <span className="font-mono">{phase || "-"}</span>
          </p>
          {joinCode ? (
            <p className="mt-1 text-xs text-cyan-100/80">
              Join code: <span className="font-mono tracking-[0.2em] text-cyan-100">{joinCode}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={lobbyHref} className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10">
            {experience === "v2" ? "Back to V2 lobby" : "Back to lobby"}
          </Link>
          {showInvite ? (
            <button
              type="button"
              className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              onClick={onOpenInvite}
              title={experience === "v2" ? "Share a direct link to this V2 table" : "Share a link to join this table"}
            >
              {experience === "v2" ? "Share table" : "Invite players"}
            </button>
          ) : null}
          <button type="button" className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10" onClick={onLeave}>
            {experience === "v2" ? "Exit table" : "Leave"}
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

export function BlackjackV2StatusStrip({
  visible,
  phase,
  timerLabel,
  timerSeconds,
  seatCount,
  spectatorCount,
  isHost,
  isMyTurn,
  unreadChat,
  onOpenChat,
  onOpenCollectibles,
  onOpenHost,
  onOpenControls,
}: {
  visible: boolean;
  phase: string;
  timerLabel: string;
  timerSeconds?: number;
  seatCount: number;
  spectatorCount: number;
  isHost: boolean;
  isMyTurn: boolean;
  unreadChat: number;
  onOpenChat: () => void;
  onOpenCollectibles: () => void;
  onOpenHost: () => void;
  onOpenControls: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="glass glass-shine rounded-3xl border border-cyan-300/15 bg-cyan-400/5 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-white/45">Round state</div>
            <div className="mt-1 text-sm font-semibold text-white">{phase || "-"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-white/45">{timerLabel || "Timer"}</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {typeof timerSeconds === "number" ? `${timerSeconds}s` : "Live"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-white/45">Seats filled</div>
            <div className="mt-1 text-sm font-semibold text-white">{seatCount}/10</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-white/45">Watching live</div>
            <div className="mt-1 text-sm font-semibold text-white">{spectatorCount}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isMyTurn ? (
            <button
              type="button"
              className="glass-soft rounded-2xl border border-emerald-300/25 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
              onClick={onOpenControls}
            >
              Open turn controls
            </button>
          ) : null}
          <button
            type="button"
            className="glass-soft relative rounded-2xl px-3 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
            onClick={onOpenChat}
          >
            Open chat
            {unreadChat > 0 ? (
              <span className="ml-2 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {Math.min(99, unreadChat)}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
            onClick={onOpenCollectibles}
          >
            Felt items
          </button>
          {isHost ? (
            <button
              type="button"
              className="glass-soft rounded-2xl px-3 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
              onClick={onOpenHost}
            >
              Host tools
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BlackjackV2OverviewPanel({
  visible,
  seated,
  spectating,
  phase,
  round,
  dealerTotal,
  myTotal,
  myBet,
  unreadChat,
  onJumpToControls,
  onJumpToTable,
  onJoinSeat,
  onJoinSpectate,
}: {
  visible: boolean;
  seated: boolean;
  spectating: boolean;
  phase: string;
  round: number;
  dealerTotal: number;
  myTotal: number | null;
  myBet: number | null;
  unreadChat: number;
  onJumpToControls: () => void;
  onJumpToTable: () => void;
  onJoinSeat: () => void;
  onJoinSpectate: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="glass glass-shine rounded-3xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/10 via-cyan-500/5 to-transparent p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-fuchsia-100/55">Blackjack Live</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/75">
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
              Round <span className="font-mono text-white">{round || 0}</span>
            </span>
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
              State <span className="font-mono text-white">{phase || "-"}</span>
            </span>
            <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1">
              Dealer lane <span className="font-mono text-white">{dealerTotal}</span>
            </span>
            {seated ? (
              <span className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                Your total <span className="font-mono">{myTotal ?? 0}</span>
                {typeof myBet === "number" ? <> • Stake <span className="font-mono">{myBet.toFixed(2)}</span></> : null}
              </span>
            ) : spectating ? (
              <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-white/75">Watching live</span>
            ) : (
              <span className="rounded-full border border-yellow-300/15 bg-yellow-500/10 px-2.5 py-1 text-yellow-100">Seat open</span>
            )}
            {unreadChat > 0 ? (
              <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-100">
                Chat <span className="font-mono">{Math.min(99, unreadChat)}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!seated && !spectating ? (
            <>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
                onClick={onJoinSeat}
              >
                Take a seat
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                onClick={onJoinSpectate}
              >
                Watch live
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
            onClick={onJumpToControls}
          >
            Open controls
          </button>
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
            onClick={onJumpToTable}
          >
            Jump to felt
          </button>
        </div>
      </div>
    </div>
  );
}

export function BlackjackV2SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">{eyebrow}</div>
        <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      </div>
      <div className="max-w-[320px] text-right text-[11px] leading-5 text-white/50">{subtitle}</div>
    </div>
  );
}

export function BlackjackV2ControlCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white/85">{title}</div>
          <div className="mt-1 text-[11px] leading-5 text-white/50">{subtitle}</div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function BlackjackV2FloatingTimer({
  visible,
  label,
  seconds,
  phase,
}: {
  visible: boolean;
  label: string;
  seconds?: number;
  phase: string;
}) {
  if (!visible) return null;

  const toneClass =
    phase === "betting"
      ? "border-amber-300/25 bg-amber-500/15 text-amber-100"
      : phase === "player_turns"
        ? "border-cyan-300/25 bg-cyan-500/15 text-cyan-100"
        : phase === "dealer_window"
          ? "border-fuchsia-300/25 bg-fuchsia-500/15 text-fuchsia-100"
          : "border-white/10 bg-white/10 text-white/85";

  return (
    <div className="pointer-events-none fixed left-4 top-24 z-[82] sm:left-6 sm:top-28">
      <div
        className={`glass glass-shine min-w-[132px] rounded-3xl border px-4 py-3 shadow-[0_22px_60px_rgba(0,0,0,.35)] backdrop-blur-xl transform-gpu ${toneClass}`}
        style={{ transform: "perspective(900px) rotateX(16deg) rotateY(-14deg) translateZ(0)" }}
      >
        <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">Live timer</div>
        <div className="mt-1 text-[11px] font-medium opacity-85">{label || "Live state"}</div>
        <div className="mt-1 font-mono text-2xl font-semibold leading-none">
          {typeof seconds === "number" ? `${seconds}s` : "LIVE"}
        </div>
      </div>
    </div>
  );
}
