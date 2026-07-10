"use client";

import type { Seat } from "./blackjackTableTypes";
import { CardView, ChipView, handValue } from "./blackjackUiPrimitives";

export function getBlackjackNameClass(nameColor?: string | null, fallback = "text-white/85") {
  const effective = String(nameColor ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    brown: "text-amber-700",
    red: "text-rose-300",
    orange: "text-orange-300",
    yellow: "text-yellow-200",
    green: "text-emerald-300",
    teal: "text-teal-300",
    blue: "text-sky-300",
    indigo: "text-indigo-300",
    violet: "text-violet-300",
    pink: "text-pink-300",
    cyan: "text-cyan-300",
    lime: "text-lime-300",
  };
  return map[effective] ?? fallback;
}

export function getBlackjackChatNameClass(nameColor?: string | null) {
  return getBlackjackNameClass(nameColor, "text-white/80");
}

export function BlackjackNameBadge({
  seat,
  currentUserId,
  currentUserNameColor,
  currentUserPrestigeLevel,
}: {
  seat: Seat;
  currentUserId?: number | null;
  currentUserNameColor?: string | null;
  currentUserPrestigeLevel?: number | null;
}) {
  const isSelf = seat.userId === currentUserId;
  const prestige = isSelf ? Number(currentUserPrestigeLevel ?? 0) : Number(seat.prestigeLevel ?? 0);
  const glow = prestige > 0 && prestige % 5 === 0 ? "drop-shadow-[0_0_12px_rgba(250,204,21,.35)]" : "";
  const avatarUrl = String(seat.avatarUrl ?? "").trim();
  const colorClass = getBlackjackNameClass(isSelf ? currentUserNameColor : seat.nameColor, "text-white/85");

  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${colorClass} ${glow}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-5 w-5 rounded-full border border-white/10 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <span>{seat.username}</span>
      {prestige >= 1 ? <span className="text-yellow-300">★{prestige}</span> : null}
    </span>
  );
}

export function BlackjackTableSeat({
  seatIndex,
  seat,
  className,
  variant,
  isTurn,
  experience = "classic",
  currentUserId,
  currentUserNameColor,
  currentUserPrestigeLevel,
}: {
  seatIndex: number;
  seat: Seat | null;
  className: string;
  variant: "list" | "table";
  isTurn: boolean;
  experience?: "classic" | "v2";
  currentUserId?: number | null;
  currentUserNameColor?: string | null;
  currentUserPrestigeLevel?: number | null;
}) {
  if (!seat) {
    if (variant === "table") return <div className={className} />;
    return (
      <div className={className}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
          {experience === "v2" ? "Seat open" : "Empty seat"}
        </div>
      </div>
    );
  }

  const hv = handValue(seat.cards, seat.bonusPoints);
  const activeHand = seat.hands?.[seat.activeHandIndex ?? 0] ?? null;
  const effects = (activeHand?.effects ?? []) as Array<{ id?: string; at?: number; fromUsername?: string; powerupName?: string }>;

  if (variant === "table") {
    return (
      <div className={className}>
        <div className={`nn-fade-in ${isTurn ? "nn-pulse-glow" : ""}`} style={isTurn ? { color: "var(--neon-cyan)" } : undefined}>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="nn-badge nn-badge-neutral">
              <BlackjackNameBadge
                seat={seat}
                currentUserId={currentUserId}
                currentUserNameColor={currentUserNameColor}
                currentUserPrestigeLevel={currentUserPrestigeLevel}
              />
            </span>
            {seat.allIn ? (
              <span className="nn-badge nn-badge-gold" title="All in">
                ALL-IN{Number(seat.allInWinStreak ?? 0) > 0 ? ` x${Number(seat.allInWinStreak)}` : ""}
              </span>
            ) : null}
            {seat.bet ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-white/70">
                <ChipView amount={Number(seat.bet)} size="sm" />
                <span className="font-mono text-white/85">{Number(seat.bet).toFixed(0)}</span>
              </span>
            ) : null}
            <span className={`nn-badge ${hv.total > 21 ? "nn-badge-red" : hv.total === 21 ? "nn-badge-gold" : "nn-badge-cyan"}`}>
              <span className="font-mono">{hv.total}</span>
              {seat.bonusPoints ? <span className="ml-1">+{seat.bonusPoints}</span> : null}
            </span>
            {seat.busted ? <span className="nn-badge nn-badge-red">{experience === "v2" ? "Busted" : "BUST"}</span> : null}
            {seat.stood ? <span className="nn-badge nn-badge-neutral">{experience === "v2" ? "Held" : "STAND"}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {seat.cards.map((c, idx) => (
              <CardView key={`${seatIndex}-${idx}`} idx={c} dealing={idx === seat.cards.length - 1} winning={!seat.busted && hv.total === 21} />
            ))}
          </div>
          {effects.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {effects.slice(-3).map((e) => (
                <span
                  key={String(e.id ?? `${e.at}-${e.powerupName}`)}
                  className="nn-badge nn-badge-magenta"
                  title={e.fromUsername ? `Used by ${e.fromUsername}` : undefined}
                >
                  {String(e.powerupName ?? "Powerup")}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`nn-card nn-card-hover p-4 ${isTurn ? "ring-2 ring-cyan-400/50" : ""}`} style={isTurn ? { boxShadow: "0 0 20px var(--neon-cyan-glow)" } : undefined}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">
            <BlackjackNameBadge
              seat={seat}
              currentUserId={currentUserId}
              currentUserNameColor={currentUserNameColor}
              currentUserPrestigeLevel={currentUserPrestigeLevel}
            />
            {seat.allIn ? (
              <span className="nn-badge nn-badge-gold ml-2">
                ALL-IN{Number(seat.allInWinStreak ?? 0) > 0 ? ` x${Number(seat.allInWinStreak)}` : ""}
              </span>
            ) : null}
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-white/60">
            <ChipView amount={Math.max(1, Math.round(seat.bet))} size="sm" />
            <span className="font-mono text-white/80">{seat.bet.toFixed(0)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {seat.cards.map((c, idx) => (
            <CardView key={`${seatIndex}-${idx}`} idx={c} dealing={idx === seat.cards.length - 1} winning={!seat.busted && hv.total === 21} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`nn-badge ${hv.total > 21 ? "nn-badge-red" : hv.total === 21 ? "nn-badge-gold" : "nn-badge-cyan"}`}>
            <span className="font-mono">{hv.total}</span>
          </span>
          {hv.soft ? <span className="text-white/45">(soft)</span> : null}
          {seat.bonusPoints ? <span className="nn-badge nn-badge-gold">+{seat.bonusPoints}</span> : null}
          {seat.busted ? <span className="nn-badge nn-badge-red">{experience === "v2" ? "Busted" : "BUST"}</span> : null}
          {seat.stood ? <span className="nn-badge nn-badge-neutral">{experience === "v2" ? "Held" : "STAND"}</span> : null}
        </div>
        {effects.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {effects.slice(-4).map((e) => (
              <span
                key={String(e.id ?? `${e.at}-${e.powerupName}`)}
                className="nn-badge nn-badge-magenta"
                title={e.fromUsername ? `Used by ${e.fromUsername}` : undefined}
              >
                {String(e.powerupName ?? "Powerup")}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
