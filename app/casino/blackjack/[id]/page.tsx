"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TurnQuickPanel } from "../../../components/TurnQuickPanel";
import { useWallet } from "../../../lib/wallet";
import { useAuth } from "../../../lib/authClient";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { rank: string; suit: Suit; value: number };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

function handValue(cards: number[], bonusPoints = 0) {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    const c = cardFromIndex(idx);
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  total += aces;
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += bonusPoints;
  return { total, soft };
}

function CardView({ idx, hidden }: { idx: number; hidden?: boolean }) {
  if (idx < 0 || hidden) {
    return (
      <div className="relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="h-[86%] w-[86%] rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
      </div>
    );
  }
  const c = cardFromIndex(idx);
  const isRed = c.suit === "♥" || c.suit === "♦";
  return (
    <div className="relative flex h-[72px] w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
      <div className={`absolute left-2 top-2 text-[9px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[8px] leading-3">{c.suit}</div>
      </div>
      <div className={`text-lg ${isRed ? "text-rose-600" : "text-zinc-900"}`}>{c.suit}</div>
      <div className={`absolute bottom-2 right-2 rotate-180 text-[9px] font-semibold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
        {c.rank}
        <div className="text-[8px] leading-3">{c.suit}</div>
      </div>
    </div>
  );
}

type Seat = {
  userId: number;
  username: string;
  prestigeLevel?: number;
  nameColor?: string | null;
  avatarUrl?: string | null;
  missedRounds: number;
  bet: number;
  cards: number[];
  activeHandIndex?: number;
  bonusPoints: number;
  stood: boolean;
  busted: boolean;
  turnEnded: boolean;
  extendUsedThisTurn?: boolean;
  inventory?: Record<string, number>;
  usedThisRound?: Record<string, boolean>;
  doublePayoutArmed?: boolean;
  bjProtected?: boolean;
  // server now attaches per-hand effect tags
  hands?: Array<{ cards: number[]; bonusPoints?: number; effects?: Array<{ id: string; at: number; fromUsername: string; powerupName: string }> }>;
};

type BJState = {
  id: string;
  name: string;
  public: boolean;
  phase: string;
  round: number;
  bettingEndsAt: number;
  turnEndsAt: number;
  dealerWindowEndsAt: number;
  turnDurationMs?: number;
  disabledCategories?: string[];
  passwordEnabled?: boolean;
  afkKickEnabled?: boolean;
  chat?: Array<{ id: string; userId: number; username: string; text: string; at: number }>;
  events?: Array<{ id: string; at: number; text: string }>;
  seats: Array<Seat | null>;
  spectators: number[];
  participants: number[];
  turnIndex: number;
  dealer: { cards: number[]; bonusPoints: number; effects?: Array<{ id: string; at: number; fromUsername: string; powerupName: string }> };
  peekCard?: number | null;
  meSeatIndex?: number;
  meInventory?: any;
  lastResult?: {
    outcome: string;
    multiplier: number;
    wager?: number;
    settlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
    ppSettlements?: Array<{ nonce: number; wager: number; multiplier: number; outcome: string }>;
  } | null;
  decorations?: Array<{
    id: string;
    ownerUserId: number;
    kind: "emoji" | "figurine";
    key?: string;
    imageUrl?: string;
    x: number;
    y: number;
    createdAt: number;
  }>;
};

export default function BlackjackTablePage() {
  const { beginBet, settleBet, balance, setBalance } = useWallet();
  const { user, discordMode } = useAuth();
  const params = useParams<{ id?: string | string[] }>();
  const tableId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined;
  const safeTableId = tableId && tableId !== "undefined" ? tableId : null;
  const rpLastRef = useRef<string>("");
  const [state, setState] = useState<BJState | null>(null);
  const stateRef = useRef<BJState | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [allIn, setAllIn] = useState(false);
  const [ppAmount, setPpAmount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [reportedKey, setReportedKey] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // When "All in" is active, keep the bet amount synced to current balance.
  useEffect(() => {
    if (!allIn) return;
    const b = Math.max(0, Math.round(Number(balance ?? 0) * 100) / 100);
    setBetAmount(b);
  }, [allIn, balance]);

  // Discord Rich Presence + Join button support (Embedded App SDK).
  useEffect(() => {
    if (!discordMode) return;
    if (!safeTableId) return;

    let cancelled = false;
    let sdk: any = null;
    let intervalId: number | null = null;

    const getJoinSecretFromPayload = (p: any): string => {
      return String(
        p?.secret ??
          p?.join_secret ??
          p?.joinSecret ??
          p?.data?.secret ??
          p?.data?.join_secret ??
          p?.data?.joinSecret ??
          "",
      );
    };

    const navToTable = (id: string) => {
      if (!id) return;
      try {
        const qs = window.location.search || "";
        if (window.location.pathname !== `/casino/blackjack/${id}`) {
          window.location.href = `/casino/blackjack/${id}${qs}`;
        }
      } catch {
        // ignore
      }
    };

    // If Discord passed a join secret as a query param, honor it.
    try {
      const sp = new URLSearchParams(window.location.search || "");
      const join = sp.get("join") || sp.get("join_secret") || "";
      if (join && join !== safeTableId) {
        navToTable(join);
        return;
      }
    } catch {
      // ignore
    }

    (async () => {
      try {
        const clientId =
          (process as any)?.env?.NEXT_PUBLIC_DISCORD_CLIENT_ID ??
          (process as any)?.env?.NEXT_PUBLIC_DISCORD_CLIENT_ID_FALLBACK ??
          "";
        if (!clientId) return;
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        // eslint-disable-next-line new-cap
        sdk = new DiscordSDK(clientId);
        await Promise.race([
          sdk.ready(),
          new Promise((_, reject) =>
            window.setTimeout(() => reject(new Error("Discord client handshake timed out.")), 9000),
          ),
        ]);
        if (cancelled) return;

        // Subscribe to join events (Discord will send the join secret).
        const subscribe = async (evt: string) => {
          try {
            await sdk.subscribe(evt, (payload: any) => {
              const secret = getJoinSecretFromPayload(payload);
              if (secret) navToTable(secret);
            });
          } catch {
            // ignore unknown events
          }
        };
        void subscribe("ACTIVITY_JOIN");
        void subscribe("ACTIVITY_JOIN_REQUEST");

        const origin = window.location.origin;
        const large = (process as any)?.env?.NEXT_PUBLIC_DISCORD_RP_LARGE_IMAGE_URL ?? `${origin}/window.svg`;
        const small = (process as any)?.env?.NEXT_PUBLIC_DISCORD_RP_SMALL_IMAGE_URL ?? `${origin}/globe.svg`;

        const pushPresence = async () => {
          const cur = stateRef.current;
          const count = cur?.seats?.filter(Boolean).length ?? 1;
          const phase = String(cur?.phase ?? "");
          const round = Number(cur?.round ?? 0) || 0;
          const payload = JSON.stringify({ id: safeTableId, count, phase, round });
          if (payload === rpLastRef.current) return;
          rpLastRef.current = payload;
          try {
            await sdk.commands.setActivity({
              activity: {
                type: 0,
                details: "Blackjack",
                state: phase ? `${phase.replaceAll("_", " ")} · R${round}` : `Table ${safeTableId}`,
                assets: {
                  large_image: large,
                  large_text: "Liquid Glass Casino",
                  small_image: small,
                  small_text: `Table ${safeTableId}`,
                },
                party: {
                  size: [Math.max(1, Math.min(10, count)), 10],
                },
                secrets: {
                  join: safeTableId,
                },
              },
            });
          } catch {
            // ignore
          }
        };

        // Initial and periodic presence updates (in case state doesn't change for a while).
        await pushPresence();
        intervalId = window.setInterval(() => void pushPresence(), 5000) as any;
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      try {
        if (sdk) {
          void sdk.unsubscribe("ACTIVITY_JOIN");
          void sdk.unsubscribe("ACTIVITY_JOIN_REQUEST");
        }
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discordMode, safeTableId]);

  const [targetPopup, setTargetPopup] = useState<{ open: boolean; specialId: string | null; target: number | null }>({
    open: false,
    specialId: null,
    target: null,
  });
  const [removeCardPopup, setRemoveCardPopup] = useState<{ open: boolean; specialId: string | null }>({
    open: false,
    specialId: null,
  });
  const [betPending, setBetPending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [bondPopup, setBondPopup] = useState<{ open: boolean; mode: "inactive" | "active" }>({ open: false, mode: "inactive" });
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [newFigOpen, setNewFigOpen] = useState(false);
  const [newFigUrl, setNewFigUrl] = useState("");
  const [newFigBusy, setNewFigBusy] = useState(false);
  const [tableEditMode, setTableEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const feltRef = useRef<HTMLDivElement | null>(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [hostTurnMs, setHostTurnMs] = useState<30_000 | 60_000>(30_000);
  const [hostDisabled, setHostDisabled] = useState<Record<string, boolean>>({});
  const [hostPasswordEnabled, setHostPasswordEnabled] = useState(false);
  const [hostPassword, setHostPassword] = useState("");
  const [hostAfkKick, setHostAfkKick] = useState(true);
  const [hostSaving, setHostSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatLastReadAt, setChatLastReadAt] = useState(0);
  const [chatScope, setChatScope] = useState<"room" | "global">("room");
  const [globalChat, setGlobalChat] = useState<{
    messages: Array<{ id: string; ts: number; userId: number; username: string; text: string }>;
    online: number;
    active1h: number;
  }>({ messages: [], online: 0, active1h: 0 });
  const [powerupToasts, setPowerupToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const [discordAutoJoinTried, setDiscordAutoJoinTried] = useState(false);
  const [tableView, setTableView] = useState<"table" | "list">(() => {
    try {
      return (localStorage.getItem("lgc.bj.tableView") as any) === "list" ? "list" : "table";
    } catch {
      return "table";
    }
  });

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!safeTableId) return "";
    return `${window.location.origin}/casino/blackjack/${safeTableId}`;
  }, [safeTableId]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Discord mode: force table id to be the call's channel_id.
  useEffect(() => {
    if (!discordMode) return;
    if (typeof window === "undefined") return;
    let channelId: string | null = null;
    try {
      const sp = new URLSearchParams(window.location.search || "");
      channelId = sp.get("channel_id");
      if (!channelId) {
        const qs = sessionStorage.getItem("lgc.discord.qs") ?? "";
        const sp2 = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
        channelId = sp2.get("channel_id");
      }
    } catch {
      // ignore
    }
    if (!channelId) return;
    if (!safeTableId) return;
    if (safeTableId === channelId) return;
    window.location.replace(`/casino/blackjack/${encodeURIComponent(channelId)}`);
  }, [discordMode, safeTableId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!safeTableId) {
          setErr("Invalid table id");
          setState(null);
          return;
        }
        const res = await fetch(`/api/blackjack/tables/${safeTableId}`, { cache: "no-store" });
        const data = (await res.json()) as any;
        if (cancelled) return;
        if (!res.ok) {
          setErr(data?.error ?? "Failed to load table");
          setState(null);
          return;
        }
        setErr(null);
        setState(data.state);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [safeTableId, tick]);

  const now = Date.now();
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 640px)")?.matches ?? false;
  }, []);

  const roundControlsRef = useRef<HTMLDivElement | null>(null);
  const tableViewRef = useRef<HTMLDivElement | null>(null);
  const dealerPowerupsRef = useRef<HTMLDivElement | null>(null);
  const [topbarOpen, setTopbarOpen] = useState<boolean>(() => {
    try {
      return (document?.documentElement?.dataset?.lgcTopbarOpen ?? "0") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: any) => {
      const open = !!e?.detail?.open;
      setTopbarOpen(open);
    };
    try {
      window.addEventListener("lgc:topbar", handler as any);
      // sync on mount
      setTopbarOpen((document?.documentElement?.dataset?.lgcTopbarOpen ?? "0") === "1");
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener("lgc:topbar", handler as any);
      } catch {
        // ignore
      }
    };
  }, []);

  const nameClass = (p: Seat) => {
    const effective = p.userId === user?.id ? (((user as any)?.name_color ?? null) as any) : p.nameColor;
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
    if (effective && map[String(effective)]) return map[String(effective)]!;
    return "text-white/85";
  };

  const NameBadge = ({ p }: { p: Seat }) => {
    const effectivePrestige =
      p.userId === user?.id ? Number((user as any)?.prestige_level ?? 0) : Number(p.prestigeLevel ?? 0);
    const prestige = effectivePrestige;
    const glow =
      prestige > 0 && prestige % 5 === 0 ? "drop-shadow-[0_0_12px_rgba(250,204,21,.35)]" : "";
    const avatarUrl = String((p as any).avatarUrl ?? "").trim();
    return (
      <span className={`inline-flex items-center gap-1 font-semibold ${nameClass(p)} ${glow}`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full border border-white/10 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span>{p.username}</span>
        {prestige >= 1 ? <span className="text-yellow-300">★{prestige}</span> : null}
      </span>
    );
  };
  const bettingLeft = Math.max(0, Math.ceil(((state?.bettingEndsAt ?? 0) - now) / 1000));
  const turnLeft = Math.max(0, Math.ceil(((state?.turnEndsAt ?? 0) - now) / 1000));
  const dealerLeft = Math.max(0, Math.ceil(((state?.dealerWindowEndsAt ?? 0) - now) / 1000));

  const mySeat = state?.meSeatIndex != null && state.meSeatIndex >= 0 ? state.seats[state.meSeatIndex] : null;
  const myTurnSeat = state?.participants?.[state.turnIndex] ?? null;
  const turnSeatObj = myTurnSeat != null && state ? (state.seats[myTurnSeat] as any) : null;
  const turnHandIndex = Number(turnSeatObj?.activeHandIndex ?? 0) || 0;
  const turnHandCount = Number(turnSeatObj?.hands?.length ?? 1) || 1;
  const isMyTurn = mySeat && state?.phase === "player_turns" && myTurnSeat === state.meSeatIndex;
  const canDoubleDown = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2 && (mySeat?.bet ?? 0) > 0;
  const canSplit = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2;
  const myHandIndex = Number((mySeat as any)?.activeHandIndex ?? 0) || 0;
  const myHandCount = Number((mySeat as any)?.hands?.length ?? 1) || 1;
  const myHands = (mySeat as any)?.hands ?? [];
  const isHost = !!mySeat && state?.meSeatIndex === 0;
  const chatMessages = state?.chat ?? [];
  const unreadChat = useMemo(() => {
    if (chatOpen) return 0;
    return chatMessages.filter((m) => (Number(m.at) || 0) > chatLastReadAt).length;
  }, [chatMessages, chatLastReadAt, chatOpen]);

  const isSpectator = !!user && !!state && Array.isArray(state.spectators) && state.spectators.includes(user.id);
  const gameActive = !!state && (!!mySeat || isSpectator);

  const bond = (state?.meInventory as any)?.bond ?? null;
  const bondOwned = Math.max(0, Number(bond?.owned ?? 0) || 0);
  const bondActive = bond?.active ?? null;
  const bondNextTickIn = bondActive
    ? Math.max(0, 60 - Math.floor((now - Number(bondActive.lastAccrualAt ?? bondActive.startedAt ?? now)) / 1000))
    : 0;

  const bonusPointsBalance = Math.max(0, Math.floor(Number((state?.meInventory as any)?.bonusPoints ?? 0) || 0));
  const allInWinStreak = Math.max(0, Math.floor(Number((state?.meInventory as any)?.allInWinStreak ?? 0) || 0));

  const collectibles = (state?.meInventory as any)?.collectibles ?? { owned: {}, figurines: [] };
  const ownedCollectibles = (collectibles?.owned ?? {}) as Record<string, number>;
  const figurines = (collectibles?.figurines ?? []) as Array<{ id: string; imageUrl: string }>;
  const decorations = (state?.decorations ?? []) as any[];

  const collectibleLabel = (k: string) => {
    const map: Record<string, string> = { SODA_CUP: "🥤", CHICKEN_WING: "🍗", FRIES: "🍟", DICE: "🎲" };
    return map[k] ?? k;
  };

  // Provide blackjack context to the global top bar.
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("lgc:blackjackCtx", {
          detail: {
            active: gameActive,
            tableId: safeTableId,
            inviteUrl,
          },
        }),
      );
    } catch {
      // ignore
    }
  }, [gameActive, safeTableId, inviteUrl]);

  const powerupLabel = (id: string) => {
    const m: Record<string, string> = {
      ADD2_SELF: "+2",
      ADD1_SELF: "+1",
      PEEK_NEXT: "👀➡️",
      BJ_PROTECTOR: "BJ🚫",
      FREE_SPLIT: "SPLIT",
      SWAP_ONE: "SWAP",
      DOUBLE_PAYOUT: "x2",
      REMOVE_RANDOM_SELF: "DEL🎲",
      REMOVE_CARD_SELF: "DEL🎯",
      ADD2_DEALER: "D+2",
      DEALER_SECOND_CHANCE: "2nd",
      ADD2_TARGET: "+2",
      FORCE_HIT_TARGET: "HIT",
      ADD1_MAGIC: "+1★",
      ADD2_MAGIC: "+2★",
      SUB1_SELF: "-1",
      SUB2_SELF: "-2",
      SUB5_SELF: "-5",
      SUB10_SELF: "-10",
      MAGIC_ACE: "A★",
      MAGIC_KING: "K★",
      MAGIC_QUEEN: "Q★",
      MAGIC_JACK: "J★",
      MAGIC_JOKER: "🃏★",
      MYTHIC_COPY_HANDS: "COPY",
    };
    return (m[id] ?? id).slice(0, 12);
  };

  const TableSeat = ({
    seatIndex,
    p,
    className,
    variant,
  }: {
    seatIndex: number;
    p: any | null;
    className: string;
    variant: "list" | "table";
  }) => {
    if (!p) {
      if (variant === "table") return <div className={className} />;
      return (
        <div className={className}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">Empty seat</div>
        </div>
      );
    }

    const hv = handValue(p.cards, p.bonusPoints);
    const isTurn = state?.phase === "player_turns" && myTurnSeat === seatIndex;
    const activeHand = (p as any)?.hands?.[(p as any)?.activeHandIndex ?? 0] ?? null;
    const effects = (activeHand?.effects ?? []) as any[];

    if (variant === "table") {
      return (
        <div className={className}>
          <div className={`${isTurn ? "drop-shadow-[0_0_18px_rgba(52,211,153,.25)]" : ""}`}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/80">
              <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 font-semibold text-white/85">
                <NameBadge p={p} />
              </span>
              {p.allIn ? (
                <span
                  className="rounded-full border border-yellow-300/25 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-100"
                  title="All in"
                >
                  🟡 ALL-IN{Number((p as any).allInWinStreak ?? 0) > 0 ? ` x${Number((p as any).allInWinStreak)}` : ""}
                </span>
              ) : null}
              {p.bet ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-white/70">
                  Bet <span className="font-mono text-white/80">{Number(p.bet).toFixed(2)}</span>
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-white/70">
                <span className="font-mono text-white/85">{hv.total}</span>
                {p.bonusPoints ? <span className="ml-1 text-amber-200">(+{p.bonusPoints})</span> : null}
              </span>
              {p.busted ? <span className="text-rose-200">BUST</span> : null}
              {p.stood ? <span className="text-white/50">STAND</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.cards.map((c: number, idx: number) => (
                <CardView key={idx} idx={c} />
              ))}
            </div>
            {effects.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {effects.slice(-3).map((e: any) => (
                  <span
                    key={String(e.id ?? `${e.at}-${e.powerupName}`)}
                    className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/70"
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
        <div className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${isTurn ? "ring-2 ring-emerald-300/50" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              <NameBadge p={p} />
              {p.allIn ? (
                <span className="ml-2 rounded-full border border-yellow-300/25 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-100">
                  ALL-IN{Number((p as any).allInWinStreak ?? 0) > 0 ? ` x${Number((p as any).allInWinStreak)}` : ""}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-white/60">
              Bet: <span className="font-mono text-white/80">{p.bet.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.cards.map((c: number, idx: number) => (
              <CardView key={idx} idx={c} />
            ))}
          </div>
          <div className="mt-2 text-xs text-white/60">
            Total: <span className="font-mono text-white/80">{hv.total}</span>
            {hv.soft ? <span className="ml-2 text-white/45">(soft)</span> : null}
            {p.bonusPoints ? <span className="ml-2 text-amber-200">(+{p.bonusPoints})</span> : null}
            {p.busted ? <span className="ml-2 text-rose-200">BUST</span> : null}
            {p.stood ? <span className="ml-2 text-white/45">STAND</span> : null}
          </div>
          {effects.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {effects.slice(-4).map((e: any) => (
                          <span
                            key={String(e.id ?? `${e.at}-${e.powerupName}`)}
                            className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
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
  };

  // Discord mode: auto-join the call table when you land on it.
  useEffect(() => {
    if (!discordMode) return;
    if (!user) return;
    if (!safeTableId) return;
    if (!state) return;
    if (discordAutoJoinTried) return;
    if (mySeat || isSpectator) {
      setDiscordAutoJoinTried(true);
      return;
    }
    setDiscordAutoJoinTried(true);
    (async () => {
      try {
        const res = await fetch(`/api/blackjack/tables/${safeTableId}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: false }),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (res.ok && data?.state) {
          setState(data.state);
          return;
        }
        // If seating fails (e.g. full), fall back to spectate.
        const res2 = await fetch(`/api/blackjack/tables/${safeTableId}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: true }),
        });
        const data2 = (await res2.json().catch(() => ({}))) as any;
        if (res2.ok && data2?.state) setState(data2.state);
      } catch {
        // ignore
      }
    })();
  }, [discordMode, user, safeTableId, state, mySeat, isSpectator, discordAutoJoinTried]);

  useEffect(() => {
    if (!hostOpen || !state) return;
    const ms = Number(state.turnDurationMs ?? 30_000) === 60_000 ? 60_000 : 30_000;
    setHostTurnMs(ms);
    const disabled = new Set<string>((state.disabledCategories ?? []).map(String));
    setHostDisabled({
      boosts: disabled.has("boosts"),
      saves: disabled.has("saves"),
      utility: disabled.has("utility"),
      magic: disabled.has("magic"),
      dealer: disabled.has("dealer"),
      mythic: disabled.has("mythic"),
    });
    setHostPasswordEnabled(!!state.passwordEnabled);
    setHostPassword("");
    setHostAfkKick(state.afkKickEnabled !== false);
  }, [hostOpen, state]);

  useEffect(() => {
    if (!chatOpen) return;
    const latest = chatMessages.reduce((a, b) => Math.max(a, Number(b.at) || 0), 0);
    if (latest > chatLastReadAt) setChatLastReadAt(latest);
  }, [chatOpen, chatMessages, chatLastReadAt]);

  const refreshGlobalChat = async () => {
    try {
      const res = await fetch("/api/chat/global", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return;
      setGlobalChat({
        messages: Array.isArray(data.messages) ? data.messages : [],
        online: Number(data.online ?? 0) || 0,
        active1h: Number(data.active1h ?? 0) || 0,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!chatOpen) return;
    if (chatScope !== "global") return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshGlobalChat();
    };
    const id = window.setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, chatScope]);

  // Table-wide powerup alerts (toast)
  useEffect(() => {
    const evs = state?.events ?? [];
    if (!evs.length) return;
    const fresh = evs.filter((e) => (Number(e.at) || 0) > lastEventAt);
    if (!fresh.length) return;
    const newestAt = fresh.reduce((a, b) => Math.max(a, Number(b.at) || 0), lastEventAt);
    setLastEventAt(newestAt);
    for (const e of fresh.slice(-6)) {
      const id = String(e.id ?? `${e.at}-${Math.random()}`);
      const text = String(e.text ?? "Powerup used");
      setPowerupToasts((t) => [...t, { id, text }].slice(-4));
      window.setTimeout(() => {
        setPowerupToasts((t) => t.filter((x) => x.id !== id));
      }, 3200);
    }
  }, [state?.events, lastEventAt]);

  const timerLabel =
    state?.phase === "betting"
      ? "Betting ends in"
      : state?.phase === "player_turns"
        ? "Turn ends in"
        : state?.phase === "dealer_window"
          ? "Dealer window"
          : null;
  const timerSeconds =
    state?.phase === "betting"
      ? bettingLeft
      : state?.phase === "player_turns"
        ? turnLeft
        : state?.phase === "dealer_window"
          ? dealerLeft
          : undefined;

  // Auto-reserve funds for carried bets.
  // If All-in is active locally, we auto-bet the full balance each round.
  useEffect(() => {
    if (!state || state.phase !== "betting") return;
    if (!mySeat) return;
    const wager = allIn ? Math.round(Number(balance ?? 0) * 100) / 100 : Number(mySeat.bet ?? 0);
    const hasNonce = Array.isArray((mySeat as any).hands?.[0]?.nonces) && ((mySeat as any).hands?.[0]?.nonces?.length ?? 0) > 0;
    if (betPending) return;
    if (!(wager > 0) || hasNonce) return;
    const started = beginBet({ game: "Blackjack (MP)", wager });
    if ("error" in started) return;
    setBetPending(true);
    void post("bet", { amount: wager, betNonce: started.nonce, allIn }).finally(() => setBetPending(false));
  }, [state?.phase, state?.round, mySeat?.bet, betPending, beginBet, allIn, balance]);

  const dealerTotal = useMemo(() => {
    if (!state) return 0;
    const visible = state.dealer.cards.filter((c) => c >= 0);
    return handValue(visible, state.dealer.bonusPoints).total;
  }, [state]);

  const canUseDealerSpecial = state?.phase === "dealer_window";
  const canUseAnytimeSpecial =
    state?.phase === "player_turns" || state?.phase === "dealer" || state?.phase === "dealer_window";

  // Report wager/profit for stats once per round (so Games gallery updates per-game totals).
  useEffect(() => {
    if (!state) return;
    if (state.phase !== "settling") return;
    if (!mySeat || !state.lastResult) return;
    const wager = Number(state.lastResult.wager ?? mySeat.bet ?? 0);
    if (!(wager > 0)) return;
    const key = `${safeTableId ?? "?"}:${state.round}`;
    if (reportedKey === key) return;

    const profit = wager * (Number(state.lastResult.multiplier ?? 0) - 1);
    setReportedKey(key);
    void fetch("/api/leaderboard/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        game: "Blackjack (MP)",
        wager,
        profit,
      }),
    }).catch(() => {});
  }, [state, mySeat, reportedKey, safeTableId]);

  // Apply payouts to the client wallet once per round (updates Topbar balance)
  const [walletSettledKey, setWalletSettledKey] = useState<string | null>(null);
  useEffect(() => {
    if (!state) return;
    if (state.phase !== "settling") return;
    if (!mySeat || !state.lastResult) return;
    const key = `wallet:${safeTableId ?? "?"}:${state.round}`;
    if (walletSettledKey === key) return;
    setWalletSettledKey(key);
    const settlements = state.lastResult.settlements ?? [];
    for (const st of settlements) {
      const nonce = Number(st.nonce);
      if (!Number.isFinite(nonce) || nonce < 0) continue;
      settleBet({
        nonce,
        multiplier: Number(st.multiplier ?? 0),
        outcome: String(st.outcome ?? "Settled"),
      });
    }
    const pp = state.lastResult.ppSettlements ?? [];
    for (const st of pp) {
      const nonce = Number(st.nonce);
      if (!Number.isFinite(nonce) || nonce < 0) continue;
      settleBet({
        nonce,
        multiplier: Number(st.multiplier ?? 0),
        outcome: String(st.outcome ?? "Perfect Pairs"),
      });
    }
  }, [state, mySeat, safeTableId, walletSettledKey, settleBet]);

  const join = async (spectate?: boolean) => {
    setErr(null);
    if (!safeTableId) {
      setErr("Invalid table id");
      return;
    }
    let password: string | undefined = undefined;
    if (state?.passwordEnabled) {
      const entered = window.prompt("Room password") ?? "";
      password = entered;
    }
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spectate: !!spectate, password }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      setErr(data?.error ?? "Failed to join");
      return;
    }
    setState(data.state);
  };

  const post = async (path: string, body?: any) => {
    setErr(null);
    if (!safeTableId) {
      setErr("Invalid table id");
      return { ok: false as const };
    }
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    const data = (await res.json()) as any;
    if (!res.ok) setErr(data?.error ?? "Action failed");
    if (data?.state) setState(data.state);
    return { ok: !!res.ok, data };
  };

  const postBond = async (body?: any) => {
    if (!safeTableId) return { ok: false as const };
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/bond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) setErr(data?.error ?? "Bond action failed");
    if (data?.state) setState(data.state);
    return { ok: !!res.ok, data };
  };

  const postCollectible = async (body?: any) => {
    if (!safeTableId) return { ok: false as const };
    const res = await fetch(`/api/blackjack/tables/${safeTableId}/collectibles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) setErr(data?.error ?? "Collectibles action failed");
    if (data?.state) setState(data.state);
    return { ok: !!res.ok, data };
  };

  // Drag handling for table edit mode
  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      if (!feltRef.current) return;
      const r = feltRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      // Optimistic local update
      setState((s) => {
        if (!s) return s;
        const decos = (s.decorations ?? []).map((d) => ({ ...d }));
        const idx = decos.findIndex((d) => d.id === dragId);
        if (idx >= 0) {
          decos[idx] = { ...decos[idx], x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        }
        return { ...(s as any), decorations: decos } as any;
      });
    };
    const onUp = async (e: PointerEvent) => {
      if (!feltRef.current) return;
      const r = feltRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const id = dragId;
      setDragId(null);
      await postCollectible({ action: "move", decorationId: id, x, y });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  // Allow the global top bar to trigger in-game actions.
  useEffect(() => {
    const onInvite = () => setInviteOpen(true);
    const onLeave = () => {
      void post("leave");
    };
    try {
      window.addEventListener("lgc:blackjackInvite", onInvite as any);
      window.addEventListener("lgc:blackjackLeave", onLeave as any);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener("lgc:blackjackInvite", onInvite as any);
        window.removeEventListener("lgc:blackjackLeave", onLeave as any);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTableId]);

  const placeBetWithWallet = async () => {
    if (state?.phase !== "betting") return;
    const wager = Math.round(Number((allIn ? balance : betAmount) ?? 0) * 100) / 100;
    if (!(wager > 0)) {
      setErr("Invalid bet amount");
      return;
    }
    if (betPending) return;
    const hasNonce = Array.isArray((mySeat as any)?.hands?.[0]?.nonces) && (((mySeat as any)?.hands?.[0]?.nonces?.length ?? 0) > 0);
    if (hasNonce) {
      setErr("Bet already placed. Clear bet first.");
      return;
    }
    const started = beginBet({ game: "Blackjack (MP)", wager });
    if ("error" in started) {
      setErr(started.error);
      return;
    }
    setBetPending(true);
    const res = await post("bet", { amount: wager, betNonce: started.nonce, allIn });
    setBetPending(false);
    // If server rejected, refund the reserved wallet bet immediately.
    if (!res?.ok) {
      settleBet({ nonce: started.nonce, multiplier: 1, outcome: "Bet canceled" });
    }
  };

  const placePerfectPairsWithWallet = async () => {
    if (state?.phase !== "betting") return;
    const wager = Math.round(Number(ppAmount ?? 0) * 100) / 100;
    if (!(wager > 0)) {
      setErr("Invalid Perfect Pairs amount");
      return;
    }
    if (betPending) return;
    const hasNonce = (mySeat as any)?.hands?.[0]?.perfectPairsNonce != null;
    if (hasNonce) {
      setErr("Perfect Pairs already placed. Clear it first.");
      return;
    }
    const started = beginBet({ game: "Blackjack PP", wager });
    if ("error" in started) {
      setErr(started.error);
      return;
    }
    setBetPending(true);
    const res = await post("perfectpairs", { amount: wager, betNonce: started.nonce });
    setBetPending(false);
    if (!res?.ok) {
      settleBet({ nonce: started.nonce, multiplier: 1, outcome: "Bet canceled" });
    }
  };

  const clearPerfectPairsWithWallet = async () => {
    if (state?.phase !== "betting") return;
    if (betPending) return;
    const nonce = Number((mySeat as any)?.hands?.[0]?.perfectPairsNonce ?? 0);
    if (Number.isFinite(nonce) && nonce >= 0) settleBet({ nonce, multiplier: 1, outcome: "Bet canceled" });
    setBetPending(true);
    await post("clearperfectpairs");
    setBetPending(false);
  };

  const clearBetWithWallet = async () => {
    if (state?.phase !== "betting") return;
    if (betPending) return;
    const nonces: number[] = ((mySeat as any)?.hands?.[0]?.nonces ?? []).filter((x: any) => Number.isFinite(x) && x >= 0);
    // Refund any reserved stake(s)
    for (const n of nonces) {
      settleBet({ nonce: n, multiplier: 1, outcome: "Bet canceled" });
    }
    setBetPending(true);
    await post("clearbet");
    setBetPending(false);
    setAllIn(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {powerupToasts.length ? (
        <div className="pointer-events-none fixed top-24 left-1/2 z-[90] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 space-y-2">
          {powerupToasts.map((t) => (
            <div
              key={t.id}
              className="glass-soft glass-shine rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 shadow-[0_18px_40px_rgba(0,0,0,.45)]"
            >
              {t.text}
            </div>
          ))}
        </div>
      ) : null}

      {/* Host options (seat 1 only) */}
      {false && isHost ? (
        <div className="pointer-events-none fixed bottom-40 left-4 z-[65]">
          <button
            type="button"
            className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
            onClick={() => setHostOpen(true)}
            title="Host settings"
          >
            <div className="font-semibold">Host options</div>
            <div className="mt-1 text-[11px] text-white/60">Turn time, powerups, password</div>
          </button>
        </div>
      ) : null}

      {/* Collectibles bubble (only when in-game) */}
      {gameActive && !tableEditMode ? (
        <div className="pointer-events-none fixed bottom-4 left-40 z-[65]">
          <button
            type="button"
            className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
            onClick={() => setCollectiblesOpen(true)}
            title="Collectibles"
            data-tour="bj-collectibles-bubble"
          >
            <div className="font-semibold">Collectibles</div>
            <div className="mt-1 text-[11px] text-white/60">Decorate the felt</div>
          </button>
        </div>
      ) : null}

      {/* Collectibles popup */}
      {collectiblesOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
          <div className="glass glass-shine w-full max-w-[560px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Collectibles</div>
                <div className="mt-1 text-xs text-white/60">Place items on the felt and drag them in edit mode.</div>
                <div className="mt-1 text-[11px] text-white/55">
                  Bonus points: <span className="font-mono text-white/80">{bonusPointsBalance}</span>{" "}
                  {allInWinStreak > 0 ? (
                    <>
                      • All-in win streak: <span className="font-mono text-white/80">{allInWinStreak}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => {
                  setCollectiblesOpen(false);
                  setTableEditMode(false);
                  setNewFigOpen(false);
                  setNewFigUrl("");
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  tableEditMode ? "border-yellow-300/25 bg-yellow-500/10 text-yellow-100" : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                onClick={() => {
                  setCollectiblesOpen(false);
                  setTableEditMode(true);
                }}
              >
                Enter table edit
              </button>
              <button
                type="button"
                disabled={bonusPointsBalance < 20}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
                onClick={() => setNewFigOpen(true)}
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
                    onChange={(e) => setNewFigUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                      onClick={() => {
                        setNewFigOpen(false);
                        setNewFigUrl("");
                      }}
                      disabled={newFigBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newFigUrl.trim() || newFigBusy}
                      className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-40"
                      onClick={async () => {
                        const url = newFigUrl.trim();
                        if (!url) return;
                        setErr(null);
                        setNewFigBusy(true);
                        const res = await postCollectible({ action: "create_figurine", imageUrl: url });
                        setNewFigBusy(false);
                        if (res.ok) {
                          setNewFigOpen(false);
                          setNewFigUrl("");
                        }
                      }}
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
                          <div className="text-lg">{collectibleLabel(k)}</div>
                          <div className="font-mono text-white/60">{v}</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-[10px] text-white/45">Sell +5 BP</div>
                          <button
                            type="button"
                            className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/10"
                            onClick={async () => {
                              const ok = window.confirm("Sell 1 emoji collectible for +5 bonus points?");
                              if (!ok) return;
                              await postCollectible({ action: "sell_emoji", key: k });
                            }}
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    ))}
                  {Object.values(ownedCollectibles).every((v) => Number(v) <= 0) ? (
                    <div className="text-xs text-white/50">No emoji collectibles yet.</div>
                  ) : null}
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
                            onClick={async () => {
                              const ok = window.confirm("Sell this figurine for +15 bonus points?");
                              if (!ok) return;
                              await postCollectible({ action: "sell_figurine", figurineId: f.id });
                            }}
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

            <div className="mt-4 text-xs text-white/50">
              Tip: enter Table Edit Mode to place and move items.
            </div>
          </div>
        </div>
      ) : null}

      {/* Table edit overlay (shows table + side inventory list) */}
      {tableEditMode && gameActive ? (
        <>
          {/* Exit bubble */}
          <div className="pointer-events-none fixed bottom-4 left-4 z-[75]">
            <button
              type="button"
              className="pointer-events-auto glass glass-shine rounded-3xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-3 text-left text-xs text-yellow-100 hover:bg-yellow-500/15"
              onClick={() => {
                setTableEditMode(false);
                setDragId(null);
              }}
              title="Exit table edit mode"
            >
              <div className="font-semibold">Table Edit</div>
              <div className="mt-1 text-[11px] text-yellow-100/70">Tap to exit</div>
            </button>
          </div>

          {/* Side inventory list */}
          <div className="pointer-events-none fixed right-3 top-28 z-[75] w-[220px] max-w-[48vw]">
            <div className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white/85">Collectibles</div>
                <button
                  type="button"
                  className="rounded-2xl px-2 py-1 text-[11px] text-white/60 hover:text-white"
                  onClick={() => setCollectiblesOpen(true)}
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
                        onClick={() => void postCollectible({ action: "place_emoji", key: k, x: 0.5, y: 0.55 })}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-base">{collectibleLabel(k)}</div>
                          <div className="font-mono text-white/60">{v}</div>
                        </div>
                      </button>
                    ))}
                  {Object.values(ownedCollectibles).every((v) => Number(v) <= 0) ? (
                    <div className="text-xs text-white/45">No emoji items.</div>
                  ) : null}
                </div>

                <div className="mt-4 text-[11px] font-semibold text-white/60">Figurines</div>
                <div className="mt-2 grid gap-2">
                  {figurines.length ? (
                    figurines.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-white/80 hover:bg-white/10"
                        onClick={() => void postCollectible({ action: "place_figurine", figurineId: f.id, x: 0.5, y: 0.55 })}
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
              <div className="mt-3 text-[10px] text-white/45">
                Drag items on the felt to move. Tap × to return to inventory.
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Floating chat bubble (bottom-left) */}
      {!tableEditMode ? (
      <div className="pointer-events-none fixed bottom-4 left-4 z-[65]">
        <button
          type="button"
          className="pointer-events-auto glass glass-shine relative rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
          onClick={() => setChatOpen(true)}
          title="Room chat"
          data-tour="bj-chat-bubble"
        >
          <div className="font-semibold">Chat</div>
          <div className="mt-1 text-[11px] text-white/60">Talk to players</div>
          {unreadChat > 0 ? (
            <div className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-fuchsia-500 px-2 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,.35)]">
              {Math.min(99, unreadChat)}
            </div>
          ) : null}
        </button>
      </div>
      ) : null}

      {hostOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
          <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Host options</div>
                <div className="mt-1 text-xs text-white/60">Only Player 1 (seat 1) can edit these.</div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => {
                  if (hostSaving) return;
                  setHostOpen(false);
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/80">Turn time</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                      hostTurnMs === 30_000 ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() => setHostTurnMs(30_000)}
                  >
                    30s
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-2 text-xs font-medium transition ${
                      hostTurnMs === 60_000 ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() => setHostTurnMs(60_000)}
                  >
                    1m
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/80">AFK kick</div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
                  <input type="checkbox" checked={hostAfkKick} onChange={(e) => setHostAfkKick(e.target.checked)} />
                  Enable AFK kick (miss 5 rounds)
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-white/80">Disable powerups</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70 sm:grid-cols-3">
                {(["boosts", "saves", "utility", "magic", "dealer", "mythic"] as const).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!hostDisabled[k]}
                      onChange={(e) => setHostDisabled((m) => ({ ...m, [k]: e.target.checked }))}
                    />
                    {k}
                  </label>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                Disabled categories cannot be used by any player in this room.
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-white/80">Password</div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={hostPasswordEnabled}
                  onChange={(e) => setHostPasswordEnabled(e.target.checked)}
                />
                Require password to join
              </label>
              {hostPasswordEnabled ? (
                <input
                  type="text"
                  value={hostPassword}
                  onChange={(e) => setHostPassword(e.target.value)}
                  placeholder="Set room password"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                />
              ) : null}
              {hostPasswordEnabled ? (
                <div className="mt-2 text-[11px] text-white/50">
                  Note: you must enter the password when saving (it is not shown back to you).
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                disabled={hostSaving}
                onClick={async () => {
                  if (!safeTableId) return;
                  if (hostPasswordEnabled && !hostPassword.trim()) {
                    setErr("Password cannot be empty.");
                    return;
                  }
                  setHostSaving(true);
                  const disabledCategories = Object.entries(hostDisabled)
                    .filter(([, v]) => !!v)
                    .map(([k]) => k);
                  const res = await post("settings", {
                    turnDurationMs: hostTurnMs,
                    disabledCategories,
                    passwordEnabled: hostPasswordEnabled,
                    password: hostPasswordEnabled ? hostPassword.trim() : undefined,
                    afkKickEnabled: hostAfkKick,
                  });
                  setHostSaving(false);
                  if (res?.ok) setHostOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {chatOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
          <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Chat</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
                      chatScope === "room" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() => setChatScope("room")}
                  >
                    Room
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
                      chatScope === "global" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() => setChatScope("global")}
                  >
                    Global
                  </button>
                  {chatScope === "global" ? (
                    <span className="ml-1 text-[11px] text-white/60">
                      Online: <span className="font-mono text-white/80">{globalChat.online}</span> • Active 1h:{" "}
                      <span className="font-mono text-white/80">{globalChat.active1h}</span>
                    </span>
                  ) : (
                    <span className="ml-1 text-[11px] text-white/60">Room messages</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setChatOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 h-[360px] overflow-auto rounded-3xl border border-white/10 bg-white/5 p-4">
              {chatScope === "global" ? (
                globalChat.messages.length ? (
                  <div className="flex flex-col gap-2">
                    {globalChat.messages.map((m) => (
                      <div key={m.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                          <span className="font-semibold text-white/80">{m.username}</span>
                          <span className="font-mono">{new Date(m.ts).toLocaleTimeString()}</span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{m.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">No messages yet.</div>
                )
              ) : chatMessages.length ? (
                <div className="flex flex-col gap-2">
                  {chatMessages.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                        <span className="font-semibold text-white/80">{m.username}</span>
                        <span className="font-mono">{new Date(m.at).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{m.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/60">No messages yet.</div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message…"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.currentTarget as any).blur?.();
                    (async () => {
                      if (!safeTableId) return;
                      const text = chatText.trim();
                      if (!text) return;
                      setChatText("");
                      if (chatScope === "global") {
                        await fetch("/api/chat/global", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ text }),
                        });
                        await refreshGlobalChat();
                      } else {
                        await post("chat", { text });
                      }
                    })();
                  }
                }}
              />
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                disabled={!chatText.trim()}
                onClick={async () => {
                  if (!safeTableId) return;
                  const text = chatText.trim();
                  if (!text) return;
                  setChatText("");
                  if (chatScope === "global") {
                    await fetch("/api/chat/global", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ text }),
                    });
                    await refreshGlobalChat();
                  } else {
                    await post("chat", { text });
                  }
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
          <div className="glass glass-shine w-full max-w-[620px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Invite players</div>
                <div className="mt-1 text-xs text-white/60">Share this link to join the room:</div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => {
                  setInviteOpen(false);
                  setInviteCopied(false);
                }}
              >
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
                  onClick={async () => {
                    if (!inviteUrl) return;
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      setInviteCopied(true);
                      window.setTimeout(() => setInviteCopied(false), 1500);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {inviteCopied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10"
                  onClick={() => {
                    if (!inviteUrl) return;
                    window.open(inviteUrl, "_blank", "noopener,noreferrer");
                  }}
                  disabled={!inviteUrl}
                >
                  Open link
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {targetPopup.open && state ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
          <div className="glass glass-shine w-full max-w-[520px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Choose target</div>
                <div className="mt-1 text-xs text-white/60 font-mono">
                  {targetPopup.specialId ? powerupLabel(targetPopup.specialId) : ""}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setTargetPopup({ open: false, specialId: null, target: null })}
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {targetPopup.specialId?.includes("MYTHIC") ? null : (
                <button
                  type="button"
                  className={`rounded-2xl border border-white/10 px-3 py-2 text-xs ${
                    targetPopup.target === -1 ? "bg-white/15 text-white" : "bg-white/5 text-white/70 hover:text-white"
                  }`}
                  onClick={() => setTargetPopup((p) => ({ ...p, target: -1 }))}
                >
                  Dealer
                </button>
              )}
              {state.seats
                .filter(Boolean)
                .map((p) => p!)
                .map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    className={`rounded-2xl border border-white/10 px-3 py-2 text-xs ${
                      targetPopup.target === p.userId
                        ? "bg-white/15 text-white"
                        : "bg-white/5 text-white/70 hover:text-white"
                    }`}
                    onClick={() => setTargetPopup((q) => ({ ...q, target: p.userId }))}
                  >
                    {p.username}
                  </button>
                ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40"
                disabled={targetPopup.target == null || !targetPopup.specialId}
                onClick={() => {
                  if (targetPopup.target == null || !targetPopup.specialId) return;
                  void post("action", {
                    type: "special",
                    specialId: targetPopup.specialId,
                    targetUserId: targetPopup.target,
                  });
                  setTargetPopup({ open: false, specialId: null, target: null });
                }}
              >
                Use powerup
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                onClick={() => setTargetPopup({ open: false, specialId: null, target: null })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bond popup */}
      {bondPopup.open ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
          <div className="glass glass-shine w-full max-w-[520px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Bonds</div>
                <div className="mt-1 text-xs text-white/60">+20% every 60 seconds while you are seated at the table.</div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setBondPopup({ open: false, mode: "inactive" })}
              >
                Close
              </button>
            </div>

            {bondPopup.mode === "inactive" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <div>
                  You have <span className="font-mono">{bondOwned}</span> bond(s).
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Bonus points: <span className="font-mono text-white/80">{bonusPointsBalance}</span>{" "}
                  {allInWinStreak > 0 ? (
                    <>
                      • All-in win streak: <span className="font-mono text-white/80">{allInWinStreak}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Activating a bond will move chips into the bond and start compounding while you stay seated.
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={bonusPointsBalance < 50}
                    className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
                    onClick={async () => {
                      setErr(null);
                      await postBond({ type: "buy" });
                    }}
                    title="Costs 50 bonus points"
                  >
                    Buy bond (50 BP)
                  </button>
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setBondPopup({ open: false, mode: "inactive" })}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bondOwned <= 0}
                    className="glass-soft rounded-2xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-40"
                    onClick={async () => {
                      if (bondOwned <= 0) return;
                      const raw = window.prompt("How many chips do you want to put in the bond?") ?? "";
                      const amt = Math.round(Number(raw) * 100) / 100;
                      if (!Number.isFinite(amt) || amt <= 0) return;
                      if (amt > Number(balance ?? 0)) {
                        setErr("Not enough chips.");
                        return;
                      }
                      const ok = window.confirm(`Activate bond with ${amt.toFixed(2)} chips?`);
                      if (!ok) return;
                      // Prototype: wallet is client-side; we deduct locally.
                      setBalance(Math.max(0, Number(balance ?? 0) - amt));
                      await postBond({ type: "activate", amount: amt });
                      setBondPopup({ open: false, mode: "inactive" });
                    }}
                  >
                    Activate Bond
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-yellow-300/15 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Active Bond Value</div>
                  <div className="font-mono">{Number(bondActive?.value ?? 0).toFixed(2)} ⓒ</div>
                </div>
                <div className="mt-2 text-xs text-yellow-100/70">
                  Principal: <span className="font-mono">{Number(bondActive?.principal ?? 0).toFixed(2)}</span> • Next
                  tick in <span className="font-mono">{bondNextTickIn}s</span>
                </div>
                <div className="mt-3 text-xs text-yellow-100/70">
                  Rules: while seated, the bond value increases by <span className="font-semibold">1.2×</span> every 60
                  seconds.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {removeCardPopup.open && state ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4">
          <div className="glass glass-shine w-full max-w-[520px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Remove a card</div>
                <div className="mt-1 text-xs text-white/60">
                  Select a card from your current hand to remove.
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setRemoveCardPopup({ open: false, specialId: null })}
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(((mySeat as any)?.hands?.[(mySeat as any)?.activeHandIndex ?? 0]?.cards ?? mySeat?.cards) as number[] | undefined)?.map(
                (c, idx) => (
                  <button
                    key={`${c}-${idx}`}
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                    onClick={() => {
                      if (!removeCardPopup.specialId) return;
                      void post("action", {
                        type: "special",
                        specialId: removeCardPopup.specialId,
                        targetUserId: null,
                        cardIndex: idx,
                      });
                      setRemoveCardPopup({ open: false, specialId: null });
                    }}
                    title="Remove this card"
                  >
                    <CardView idx={c} />
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}
      <TurnQuickPanel
        show={!!state && !!mySeat}
        isMyTurn={!!isMyTurn}
        myBet={Number(mySeat?.bet ?? 0)}
        handIndex={myHandIndex}
        handCount={myHandCount}
        hands={myHands}
        timerLabel={timerLabel ?? undefined}
        timerSeconds={typeof timerSeconds === "number" ? timerSeconds : undefined}
        onTimerClick={() => {
          const phase = state?.phase;
          const scroll = (el: HTMLElement | null) => {
            if (!el) return;
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          };
          if (phase === "betting") {
            scroll(roundControlsRef.current);
            return;
          }
          if (phase === "dealer_window") {
            scroll(dealerPowerupsRef.current);
            return;
          }
          // "Play phase" (player_turns / dealer / settling) -> card/table view
          scroll(tableViewRef.current);
        }}
        canSplit={canSplit}
        canHit={!mySeat?.busted}
        canDoubleDown={canDoubleDown}
        canExtend={true}
        extendUsed={!!mySeat?.extendUsedThisTurn}
        onHit={() => post("action", { type: "hit" })}
        onStand={() => post("action", { type: "stand" })}
        onDoubleDown={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "double_down", betNonce: started.nonce });
        }}
        onSplit={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "split", betNonce: started.nonce });
        }}
        onExtend={() => post("action", { type: "extend_timer" })}
        dealerCards={state?.dealer?.cards ?? []}
        dealerBonusPoints={Number((state as any)?.dealer?.bonusPoints ?? 0)}
        myCards={mySeat?.cards ?? []}
        myBonusPoints={Number((myHands as any)?.[myHandIndex]?.bonusPoints ?? (mySeat as any)?.bonusPoints ?? 0)}
      />
      {state && (mySeat || isSpectator) && topbarOpen ? (
        <div className="glass glass-shine rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{state?.name ?? "Blackjack Table"}</h2>
              <p className="mt-1 text-sm text-white/60">
                Table: <span className="font-mono">{safeTableId ?? "-"}</span> • Round{" "}
                <span className="font-mono">{state?.round ?? "-"}</span> • Phase{" "}
                <span className="font-mono">{state?.phase ?? "-"}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/casino/blackjack"
                className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              >
                Back to lobby
              </Link>
              <button
                type="button"
                className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                onClick={() => setInviteOpen(true)}
                title="Share a link to join this table"
              >
                Invite players
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                onClick={() => post("leave")}
              >
                Leave
              </button>
            </div>
          </div>
          {err ? <div className="mt-3 text-sm text-rose-200">{err}</div> : null}
        </div>
      ) : null}

      {/* Top-of-page turn actions (non-popup) */}
      {state && mySeat && isMyTurn ? (
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
                onClick={() => post("action", { type: "hit" })}
                disabled={!!mySeat?.busted}
              >
                Hit
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                onClick={() => post("action", { type: "stand" })}
              >
                Stand
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                onClick={() => {
                  const wager = Number(mySeat?.bet ?? 0);
                  const started = beginBet({ game: "Arcade Blackjack", wager });
                  if ("error" in started) {
                    setErr(started.error);
                    return;
                  }
                  void post("action", { type: "double_down", betNonce: started.nonce });
                }}
                disabled={!canDoubleDown}
                title="Double your bet, draw one card, and stand"
              >
                DD
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                onClick={() => {
                  const wager = Number(mySeat?.bet ?? 0);
                  const started = beginBet({ game: "Arcade Blackjack", wager });
                  if ("error" in started) {
                    setErr(started.error);
                    return;
                  }
                  void post("action", { type: "split", betNonce: started.nonce });
                }}
                disabled={!canSplit}
                title="Split (up to 4 hands). If your cards don't match, requires FREE_SPLIT."
              >
                Split
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                onClick={() => post("action", { type: "vote_skip" })}
                title="Skip the remaining turn timer"
              >
                Vote skip
              </button>
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                onClick={() => post("action", { type: "extend_timer" })}
                disabled={!!mySeat?.extendUsedThisTurn}
                title="Extend your turn timer once"
              >
                Extend timer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!state ? (
        <div className="glass-soft rounded-3xl p-5 text-white/70">
          {err ? (
            <>
              <div className="text-sm font-semibold text-rose-200">{err}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/casino/blackjack"
                  className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                >
                  Return to lobby
                </Link>
              </div>

            </>
          ) : (
            "Loading…"
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div ref={roundControlsRef} className="glass-soft glass-shine rounded-3xl p-5" data-tour="bj-round-controls">
            <p className="text-sm font-medium text-white">Round controls</p>
            <div className="mt-3 text-xs text-white/60">
            {state.phase === "betting" ? (
                <>Betting ends in <span className="font-mono text-white/80">{bettingLeft}s</span></>
              ) : state.phase === "player_turns" ? (
              <>
                Turn ends in <span className="font-mono text-white/80">{turnLeft}s</span>
                {turnHandCount > 1 ? (
                  <span className="ml-2 text-[11px] text-white/55">
                    (Hand {turnHandIndex + 1}/{turnHandCount})
                  </span>
                ) : null}
              </>
              ) : state.phase === "dealer_window" ? (
                <>Dealer window <span className="font-mono text-white/80">{dealerLeft}s</span></>
              ) : (
                <>In progress…</>
              )}
            </div>

            {mySeat ? (
              <>
                {state.phase === "betting" ? (
                  <>
                    <label className="mt-4 block text-xs text-white/60">Bet amount (ⓒ)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                      }}
                      disabled={allIn}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={betPending || ((mySeat as any)?.hands?.[0]?.nonces?.length ?? 0) > 0}
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                        onClick={placeBetWithWallet}
                        data-tour="bj-place-bet"
                      >
                        Place bet
                      </button>
                      <button
                        type="button"
                        disabled={betPending || ((mySeat as any)?.hands?.[0]?.nonces?.length ?? 0) > 0}
                        className={`glass-soft rounded-2xl px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-40 ${
                          allIn ? "border border-yellow-300/25 bg-yellow-500/10 text-yellow-100" : "text-white/80"
                        }`}
                        onClick={() => setAllIn((v) => !v)}
                        title="Bet your full balance"
                        data-tour="bj-all-in"
                      >
                        All in
                      </button>
                      <button
                        type="button"
                        disabled={betPending || (((mySeat as any)?.hands?.[0]?.nonces?.length ?? 0) === 0)}
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
                        onClick={clearBetWithWallet}
                      >
                        Clear bet
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                        onClick={async () => {
                          // If a bet was reserved, refund it before skipping.
                          const nonces: number[] = ((mySeat as any)?.hands?.[0]?.nonces ?? []).filter(
                            (x: any) => Number.isFinite(x) && x >= 0,
                          );
                          for (const n of nonces) settleBet({ nonce: n, multiplier: 1, outcome: "Bet canceled" });
                          await post("skip");
                          setAllIn(false);
                        }}
                      >
                        Skip round
                      </button>
                    </div>

                    <div className="mt-3 text-[11px] text-white/60">
                      Bonus points: <span className="font-mono text-white/80">{bonusPointsBalance}</span>{" "}
                      {allInWinStreak > 0 ? (
                        <>
                          • All-in win streak: <span className="font-mono text-white/80">{allInWinStreak}</span>
                        </>
                      ) : null}{" "}
                      • Spend: Figurine <span className="font-mono">20</span> / Bond <span className="font-mono">50</span>
                    </div>

                    <label className="mt-5 block text-xs text-white/60">Perfect Pairs side bet (ⓒ)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={ppAmount}
                      onChange={(e) => setPpAmount(Number(e.target.value))}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                      }}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={betPending || (mySeat as any)?.hands?.[0]?.perfectPairsNonce != null}
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-40"
                        onClick={placePerfectPairsWithWallet}
                        title="Pays on first 2 cards of each hand: perfect=25:1, colored=12:1, mixed=6:1"
                      >
                        Add PP bet
                      </button>
                      <button
                        type="button"
                        disabled={betPending || (mySeat as any)?.hands?.[0]?.perfectPairsNonce == null}
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                        onClick={clearPerfectPairsWithWallet}
                      >
                        Clear PP bet
                      </button>
                    </div>
                  </>
                ) : null}

                {state.peekCard != null ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    Peek:{" "}
                    <span className="font-mono text-white/90">
                      {state.peekCard < 0 ? "None" : `${cardFromIndex(state.peekCard).rank}${cardFromIndex(state.peekCard).suit}`}
                    </span>
                  </div>
                ) : null}

                {state.lastResult ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    Last result: <span className="text-white/90">{state.lastResult.outcome}</span> •{" "}
                    <span className="font-mono text-white/90">{state.lastResult.multiplier.toFixed(2)}x</span>
                  </div>
                ) : null}

                <div className="mt-5" data-tour="bj-specials">
                  <p className="text-xs font-medium text-white/70">Specials</p>
                  {state.meInventory ? (
                    <div className="mt-2 text-[11px] text-white/55">
                      Hands played: <span className="font-mono text-white/80">{state.meInventory.handsPlayed ?? 0}</span>{" "}
                      • Next box in{" "}
                      <span className="font-mono text-white/80">
                        {(() => {
                          const hp = Number(state.meInventory.handsPlayed ?? 0);
                          const rem = hp % 3;
                          return rem === 0 ? 3 : 3 - rem;
                        })()}
                      </span>{" "}
                      hands
                    </div>
                  ) : null}
                  {Array.isArray(state.meInventory?.lastBox) && state.meInventory.lastBox.length ? (
                    <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                      Mystery Box: <span className="font-mono">{state.meInventory.lastBox.join(", ")}</span>
                    </div>
                  ) : null}
                  {/* Target is selected only when needed (via the popup). */}
                  {(() => {
                    const inv = state.meInventory;
                    const cats = inv?.categories;
                    const catOrder: Array<{ id: string; label: string }> = [
                      { id: "boosts", label: "Boosts" },
                      { id: "saves", label: "Saves" },
                      { id: "utility", label: "Utility" },
                      { id: "magic", label: "Magic" },
                      { id: "mythic", label: "Mythic" },
                      { id: "dealer", label: "Dealer" },
                    ];

                    const groups: Array<{ label: string; items: Array<[string, number]> }> = [];

                    if (cats && typeof cats === "object") {
                      for (const c of catOrder) {
                        const entries = Object.entries(cats[c.id] ?? {}).filter(([, v]: any) => Number(v) > 0) as Array<
                          [string, number]
                        >;
                        if (entries.length) groups.push({ label: c.label, items: entries });
                      }
                    } else if (inv && typeof inv === "object") {
                      const entries = Object.entries(inv)
                        .filter(([, v]) => typeof v === "number" && v > 0)
                        .map(([k, v]) => [k, v as number] as [string, number]);
                      groups.push({ label: "Inventory", items: entries });
                    }

                    if (groups.length === 0) {
                      return <div className="mt-2 text-xs text-white/50">No powerups yet.</div>;
                    }

                    return (
                      <div ref={dealerPowerupsRef} className="mt-3">
                        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
                          {groups.map((g) => (
                            <div key={g.label} className="min-w-0">
                              <div className="mb-2 text-[11px] font-semibold text-white/60">{g.label}</div>
                              <div className="flex flex-col gap-2">
                                {g.items.map(([k, v]) => {
                                  const isDealerWindowCard =
                                    k.includes("DEALER") && !k.includes("TARGET") && !k.includes("MAGIC");
                                  const isAnytimeCard = k.includes("TARGET") || k.includes("MAGIC") || k.includes("MYTHIC");
                                  const isBettingCard = k === "BJ_PROTECTOR" || k === "DOUBLE_PAYOUT";
                                  const enabled =
                                    v > 0 &&
                                    (isDealerWindowCard
                                      ? !!canUseDealerSpecial
                                      : isAnytimeCard
                                        ? !!canUseAnytimeSpecial
                                        : isBettingCard
                                          ? state?.phase === "betting"
                                          : !!isMyTurn);
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                                      disabled={!enabled}
                                      onClick={() => {
                                      if (k === "REMOVE_CARD_SELF") {
                                        setRemoveCardPopup({ open: true, specialId: k });
                                        return;
                                      }
                                        if (isAnytimeCard) {
                                          // Force explicit target choice via popup.
                                          setTargetPopup({ open: true, specialId: k, target: null });
                                          return;
                                        }
                                        void post("action", {
                                          type: "special",
                                          specialId: k,
                                          targetUserId: null,
                                        cardIndex: null,
                                        });
                                      }}
                                      title={k}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="font-semibold text-white">{powerupLabel(k)}</div>
                                        <div className="font-mono text-white/60">{v}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Bonds (prestige item) */}
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold text-white/80">Bonds</div>
                            <div className="text-[11px] text-white/60">
                              Owned: <span className="font-mono text-white/80">{bondOwned}</span>
                            </div>
                          </div>
                          {bondActive ? (
                            <button
                              type="button"
                              className="mt-2 w-full rounded-xl border border-yellow-300/15 bg-yellow-500/10 px-2 py-2 text-left text-[11px] text-yellow-100 hover:bg-yellow-500/15"
                              onClick={() => setBondPopup({ open: true, mode: "active" })}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">Active Bond</div>
                                <div className="font-mono">{Number(bondActive.value ?? 0).toFixed(2)} ⓒ</div>
                              </div>
                              <div className="mt-1 text-[10px] text-yellow-100/70">+20% every 60s while seated • next in {bondNextTickIn}s</div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={bondOwned <= 0}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                              onClick={() => setBondPopup({ open: true, mode: "inactive" })}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">Inactive Bond</div>
                                <div className="font-mono text-white/60">{bondOwned > 0 ? "Tap to activate" : "Buy in Prestige Shop"}</div>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-2 text-[11px] text-white/50">
                    Common cards usually work only on your turn. Rare “TARGET” / “MAGIC” cards can be played any time before the end of the round.
                    Stacking is allowed. Use “-1/-2/-5/-10” on your turn to save yourself from bust before your turn ends.
                  </div>
                </div>

                {isMyTurn ? (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-white/70">Your turn</p>
                    {mySeat?.busted ? (
                      <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                        BUSTED — play a save card (-1/-2/-5/-10) before your turn ends, or Stand to accept bust.
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                        onClick={() => post("action", { type: "hit" })}
                        disabled={!!mySeat?.busted}
                      >
                        Hit
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                        onClick={() => post("action", { type: "stand" })}
                      >
                        Stand
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                        onClick={() => {
                          const wager = Number(mySeat?.bet ?? 0);
                          const started = beginBet({ game: "Blackjack (MP)", wager });
                          if ("error" in started) {
                            setErr(started.error);
                            return;
                          }
                          void post("action", { type: "double_down", betNonce: started.nonce });
                        }}
                        disabled={!canDoubleDown}
                        title="Double your bet, draw one card, and stand"
                      >
                        DD
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                        onClick={() => {
                          const wager = Number(mySeat?.bet ?? 0);
                          const started = beginBet({ game: "Blackjack (MP)", wager });
                          if ("error" in started) {
                            setErr(started.error);
                            return;
                          }
                          void post("action", { type: "split", betNonce: started.nonce });
                        }}
                        disabled={!canSplit}
                        title="Split (up to 4 hands). If your cards don't match, requires FREE_SPLIT."
                      >
                        Split
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                        onClick={() => post("action", { type: "vote_skip" })}
                        title="Skip the remaining turn timer"
                      >
                        Vote skip timer
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                        onClick={() => post("action", { type: "extend_timer" })}
                        disabled={!!mySeat?.extendUsedThisTurn}
                        title="Extend your turn timer once"
                      >
                        Extend timer
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 text-[11px] text-white/55">
                  Missed rounds: <span className="font-mono">{mySeat.missedRounds}</span>/5
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                  onClick={() => join(false)}
                >
                  Join (seat)
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
                  onClick={() => join(true)}
                >
                  Spectate
                </button>
              </div>
            )}
          </div>

          <div ref={tableViewRef} className="glass-soft glass-shine rounded-3xl p-5">
            <p className="text-sm font-medium text-white">Table</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">View</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-1.5 text-xs ${
                    tableView === "table" ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                  }`}
                  onClick={() => {
                    try {
                      localStorage.setItem("lgc.bj.tableView", "table");
                    } catch {}
                    setTableView("table");
                  }}
                >
                  Table
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-1.5 text-xs ${
                    tableView === "list" ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                  }`}
                  onClick={() => {
                    try {
                      localStorage.setItem("lgc.bj.tableView", "list");
                    } catch {}
                    setTableView("list");
                  }}
                >
                  List
                </button>
              </div>
            </div>

            {tableView === "list" ? (
              <div className="mt-4">
                <p className="text-xs text-white/60">Dealer</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.dealer.cards.map((c, i) => (
                    <CardView key={i} idx={c} hidden={c < 0} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/55">
                  Visible total: <span className="font-mono text-white/80">{dealerTotal}</span>
                </p>
                {(state as any)?.dealer?.effects?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {((state as any).dealer.effects as any[])
                      .slice(-4)
                      .map((e: any) => (
                        <span
                          key={String(e.id ?? `${e.at}-${e.powerupName}`)}
                          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
                          title={e.fromUsername ? `Used by ${e.fromUsername}` : undefined}
                        >
                          {String(e.powerupName ?? "Powerup")}
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-xs text-white/60">Seats</p>
              {tableView === "list" ? (
                <div className="mt-2 grid grid-cols-1 gap-3">
                  {state.seats.map((p, i) => (
                    <TableSeat key={i} seatIndex={i} p={p as any} className="" variant="list" />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <div
                    className={`relative mx-auto w-full max-w-[640px] ${isMobile ? "origin-top scale-[0.88]" : ""}`}
                  >
                    {/* Felt container for collectibles */}
                    <div ref={feltRef} className="absolute inset-0">
                      {decorations.map((d: any) => {
                        const mine = Number(d.ownerUserId ?? 0) === Number(user?.id ?? 0);
                        const canEdit = tableEditMode && mine;
                        const left = `${Math.max(0, Math.min(1, Number(d.x ?? 0.5))) * 100}%`;
                        const top = `${Math.max(0, Math.min(1, Number(d.y ?? 0.5))) * 100}%`;
                        return (
                          <div
                            key={d.id}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 ${canEdit ? "pointer-events-auto" : "pointer-events-none"}`}
                            style={{ left, top }}
                            onPointerDown={(e) => {
                              if (!canEdit) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setDragId(String(d.id));
                            }}
                            title={canEdit ? "Drag to move" : undefined}
                          >
                            {canEdit ? (
                              <button
                                type="button"
                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[12px] font-semibold text-white/90 hover:bg-black/60"
                                onPointerDown={(e) => {
                                  // prevent starting a drag
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void postCollectible({ action: "pickup", decorationId: d.id });
                                }}
                                title="Return to inventory"
                              >
                                ×
                              </button>
                            ) : null}
                            {d.kind === "figurine" ? (
                              <img
                                src={String(d.imageUrl ?? "")}
                                alt=""
                                className="h-14 w-14 rounded-xl border border-white/10 bg-black/20 object-cover"
                              />
                            ) : (
                              <div className="text-3xl">{collectibleLabel(String(d.key ?? ""))}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mx-auto h-[560px] w-full rounded-[48px] border border-white/10 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-black/25 shadow-[0_40px_120px_rgba(0,0,0,.45)]" />
                    <div className="pointer-events-none absolute inset-0 rounded-[48px] ring-1 ring-white/10" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {/* Rotate 90° for a portrait-friendly felt oval */}
                      <div className="h-[480px] w-[320px] rounded-[999px] border border-white/10 bg-gradient-to-b from-emerald-500/12 to-black/20" />
                    </div>

                    {/* Dealer hand (on felt) */}
                    <div className="absolute left-1/2 top-8 w-[360px] -translate-x-1/2">
                      <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-white/80">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-semibold text-white/85">
                          Dealer
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-white/70">
                          Visible <span className="font-mono text-white/85">{dealerTotal}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {state.dealer.cards.map((c, i) => (
                          <CardView key={i} idx={c} hidden={c < 0} />
                        ))}
                      </div>
                    </div>

                    {/* Seats on the sides (no center seats) */}
                    {(() => {
                      // Alternate sides down the table:
                      // seat 0 = left, seat 1 = right, seat 2 = left, ...
                      // seat 0 also sits a bit higher to reduce overlap with other hands.
                      const leftTops = [92, 182, 272, 362, 452]; // px
                      const rightTops = [104, 194, 284, 374, 464]; // slight stagger
                      return state.seats.map((p, i) => {
                        const isLeft = i % 2 === 0;
                        const rank = Math.floor(i / 2);
                        const topPx = isLeft ? leftTops[rank] ?? 452 : rightTops[rank] ?? 464;
                        return (
                          <div
                            key={i}
                            className={`absolute ${isLeft ? "left-4" : "right-4"} w-[260px]`}
                            style={{ top: topPx }}
                          >
                            <TableSeat seatIndex={i} p={p as any} className="" variant="table" />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {isMobile ? <div className="mt-2 text-[11px] text-white/45">Tip: switch to List view if this feels too small.</div> : null}
                </div>
              )}
              <div className="mt-3 text-xs text-white/55">
                Spectators: <span className="font-mono">{state.spectators.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-center text-xs text-white/45">
        Arcade Blackjack game mode inspired by <span className="font-semibold text-white/60">xyzzy’s blackjack</span>
      </div>
    </div>
  );
}
