"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TurnQuickPanel } from "../../../components/TurnQuickPanel";
import { useWallet } from "../../../lib/wallet";
import { useAuth } from "../../../lib/authClient";
import { useUiLayout } from "../../../lib/uiLayout";
import { BlackjackChatPanel } from "../blackjackChatPanel";
import { blackjackCollectibleLabel, BlackjackCollectiblesPanel, BlackjackTableEditInventory } from "../blackjackCollectiblesPanel";
import { BlackjackHostPanel } from "../blackjackHostPanel";
import { BlackjackInviteModal, BlackjackTableHeader, BlackjackTurnActionBar, BlackjackV2ControlCard, BlackjackV2FloatingTimer, BlackjackV2OverviewPanel, BlackjackV2SectionHeader, BlackjackV2StatusStrip } from "../blackjackTableShell";
import { type BJState, type Seat } from "../blackjackTableTypes";
import { CardView, cardFromIndex, handValue, PowerupStickerIcon } from "../blackjackUiPrimitives";
import { BlackjackTableSeat, getBlackjackChatNameClass } from "../blackjackSeatViews";
import { useBlackjackTableContract } from "../useBlackjackTableContract";

export function BlackjackTablePageClient({
  routeBase = "/casino/blackjack",
  lobbyHref = "/casino/blackjack-v2",
  experience = "classic",
}: {
  routeBase?: string;
  lobbyHref?: string;
  experience?: "classic" | "v2";
}) {
  const { beginBet, balance, reserveServerBet, settleServerBet, cancelServerBet, adjustServerBalance } = useWallet();
  const { user, discordMode } = useAuth();
  const { layout: uiLayout } = useUiLayout();
  const params = useParams<{ id?: string | string[] }>();
  const tableId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined;
  const safeTableId = tableId && tableId !== "undefined" ? tableId : null;
  const rpLastRef = useRef<string>("");
  const [tick, setTick] = useState(0);
  const { state, setState, tableMeta, err, setErr, applyTablePayload, requestTableRoute } =
    useBlackjackTableContract<BJState>(safeTableId);
  const stateRef = useRef<BJState | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [allIn, setAllIn] = useState(false);
  const [ppAmount, setPpAmount] = useState(0);
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
        if (window.location.pathname !== `${routeBase}/${id}`) {
          window.location.href = `${routeBase}/${id}${qs}`;
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
  }, [discordMode, safeTableId, routeBase]);

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
  const [bondPopup, setBondPopup] = useState<{ open: boolean; mode: "inactive" | "active" | "choose_amount" }>({
    open: false,
    mode: "inactive",
  });
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
    messages: Array<{ id: string; ts: number; userId: number; username: string; text: string; prestigeLevel?: number; nameColor?: string | null }>;
    online: number;
    active1h: number;
  }>({ messages: [], online: 0, active1h: 0 });
  const [powerupToasts, setPowerupToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const [discordAutoJoinTried, setDiscordAutoJoinTried] = useState(false);
  const tableViewStorageKey = experience === "v2" ? "lgc.bj.v2.tableView" : "lgc.bj.tableView";
  const [tableView, setTableView] = useState<"table" | "list">(() => {
    try {
      return (localStorage.getItem(tableViewStorageKey) as any) === "list" ? "list" : "table";
    } catch {
      return "table";
    }
  });

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!safeTableId) return "";
    return `${window.location.origin}${routeBase}/${safeTableId}`;
  }, [safeTableId, routeBase]);

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
    window.location.replace(`${routeBase}/${encodeURIComponent(channelId)}`);
  }, [discordMode, safeTableId, routeBase]);


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

  const now = Date.now();
  const bettingLeft = Math.max(0, Math.ceil(((state?.bettingEndsAt ?? 0) - now) / 1000));
  const turnLeft = Math.max(0, Math.ceil(((state?.turnEndsAt ?? 0) - now) / 1000));
  const dealerLeft = Math.max(0, Math.ceil(((state?.dealerWindowEndsAt ?? 0) - now) / 1000));

  const meSeatIndex = Number(tableMeta?.meSeatIndex ?? state?.meSeatIndex ?? -1);
  const mySeat = meSeatIndex >= 0 && state ? state.seats[meSeatIndex] : null;
  const myTurnSeat = tableMeta?.currentTurnSeatIndex ?? state?.participants?.[state.turnIndex] ?? null;
  const turnSeatObj = myTurnSeat != null && state ? (state.seats[myTurnSeat] as any) : null;
  const turnHandIndex = Number(turnSeatObj?.activeHandIndex ?? 0) || 0;
  const turnHandCount = Number(turnSeatObj?.hands?.length ?? 1) || 1;
  const isMyTurn = mySeat && state?.phase === "player_turns" && myTurnSeat === meSeatIndex;
  const canDoubleDown = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2 && (mySeat?.bet ?? 0) > 0;
  const canSplit = !!isMyTurn && !mySeat?.busted && (mySeat?.cards?.length ?? 0) === 2;
  const myHandIndex = Number((mySeat as any)?.activeHandIndex ?? 0) || 0;
  const myHandCount = Number((mySeat as any)?.hands?.length ?? 1) || 1;
  const myHands = (mySeat as any)?.hands ?? [];
  const myLiveTotal = mySeat
    ? handValue(
        mySeat.cards ?? [],
        Number((myHands as any)?.[myHandIndex]?.bonusPoints ?? (mySeat as any)?.bonusPoints ?? 0),
      ).total
    : null;
  const isHost = !!mySeat && meSeatIndex === 0;
  const chatMessages = state?.chat ?? [];
  const unreadChat = useMemo(() => {
    if (chatOpen) return 0;
    return chatMessages.filter((m) => (Number(m.at) || 0) > chatLastReadAt).length;
  }, [chatMessages, chatLastReadAt, chatOpen]);

  const isSpectator = !!tableMeta?.isSpectator || (!!user && !!state && Array.isArray(state.spectators) && state.spectators.includes(user.id));
  const gameActive = !!state && (!!(tableMeta?.isSeated ?? mySeat) || isSpectator);

  const bond = (state?.meInventory as any)?.bond ?? null;
  const bondOwned = Math.max(0, Number(bond?.owned ?? 0) || 0);
  const bondActive = bond?.active ?? null;
  const bondNextTickIn = bondActive
    ? Math.max(0, 60 - Math.floor((now - Number(bondActive.lastAccrualAt ?? bondActive.startedAt ?? now)) / 1000))
    : 0;

  const bonusPointsBalance = Math.max(0, Math.floor(Number((state?.meInventory as any)?.bonusPoints ?? 0) || 0));
  const allInWinStreak = Math.max(0, Math.floor(Number((state?.meInventory as any)?.allInWinStreak ?? 0) || 0));
  const bondAmountPercents = [10, 25, 50, 75, 90, 100] as const;

  const collectibles = (state?.meInventory as any)?.collectibles ?? { owned: {}, figurines: [] };
  const ownedCollectibles = (collectibles?.owned ?? {}) as Record<string, number>;
  const figurines = (collectibles?.figurines ?? []) as Array<{ id: string; imageUrl: string }>;
  const decorations = (state?.decorations ?? []) as any[];
  const showV2Shell = experience === "v2";
  const horizontalMode = showV2Shell && uiLayout === "horizontal";
  const v2HeaderVisible = !!(state && topbarOpen);
  const classicHeaderVisible = !!(state && (mySeat || isSpectator) && topbarOpen);
  const [hControlsOpen, setHControlsOpen] = useState(false);
  const [hMenuOpen, setHMenuOpen] = useState(false);
  const myHasLockedStake =
    !!mySeat && (Number(mySeat?.bet ?? 0) > 0 || (((mySeat as any)?.hands?.[0]?.nonces?.length ?? 0) > 0));
  const showHorizontalStakeDock = horizontalMode && !!state && state.phase === "betting" && !!mySeat && !myHasLockedStake;
  const horizontalShowLiveDock = horizontalMode && !!state && state.phase !== "betting" && !!mySeat;
  const horizontalApplicablePowerups: Array<[string, number]> = (() => {
    if (!horizontalShowLiveDock || !state?.meInventory) return [];

    const inv = state.meInventory;
    const cats = inv?.categories;
    const entries: Array<[string, number]> = [];

    if (cats && typeof cats === "object") {
      for (const bucket of Object.values(cats) as Array<Record<string, number>>) {
        for (const [k, v] of Object.entries(bucket ?? {})) {
          if (Number(v) > 0) entries.push([k, Number(v)]);
        }
      }
    } else {
      for (const [k, v] of Object.entries(inv ?? {})) {
        if (typeof v === "number" && v > 0) entries.push([k, Number(v)]);
      }
    }

    return entries.filter(([k, v]) => {
      if (v <= 0) return false;
      const isDealerWindowCard = k.includes("DEALER") && !k.includes("TARGET") && !k.includes("MAGIC");
      const isAnytimeCard = k.includes("TARGET") || k.includes("MAGIC") || k.includes("MYTHIC");
      const isBettingCard = k === "BJ_PROTECTOR" || k === "DOUBLE_PAYOUT";
      return isDealerWindowCard
        ? !!canUseDealerSpecial
        : isAnytimeCard
          ? !!canUseAnytimeSpecial
          : isBettingCard
            ? state?.phase === "betting"
            : !!isMyTurn;
    });
  })();
  const roundStatusLabel = !state
    ? ""
    : state.phase === "betting"
      ? showV2Shell
        ? "Betting window closes in"
        : "Betting ends in"
      : state.phase === "player_turns"
        ? showV2Shell
          ? "Turn clock"
          : "Turn ends in"
        : state.phase === "dealer_window"
          ? showV2Shell
            ? "Dealer response window"
            : "Dealer window"
          : showV2Shell
            ? "Round resolving…"
            : "In progress…";
  const scrollToSection = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!horizontalMode) {
      setHControlsOpen(false);
      setHMenuOpen(false);
    }
  }, [horizontalMode]);

  const usePowerupQuick = (specialId: string) => {
    if (specialId === "REMOVE_CARD_SELF") {
      setRemoveCardPopup({ open: true, specialId });
      return;
    }
    if (specialId.includes("TARGET") || specialId.includes("MAGIC") || specialId.includes("MYTHIC")) {
      setTargetPopup({ open: true, specialId, target: null });
      return;
    }
    void post("action", {
      type: "special",
      specialId,
      targetUserId: null,
      cardIndex: null,
    });
  };

  // Provide blackjack context to the global top bar.
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("lgc:blackjackCtx", {
          detail: {
            active: gameActive,
            tableId: tableMeta?.tableId ?? safeTableId,
            inviteUrl,
          },
        }),
      );
    } catch {
      // ignore
    }
  }, [gameActive, safeTableId, tableMeta?.tableId, inviteUrl]);

  const powerupLabel = (id: string) => {
    const m: Record<string, string> = {
      ADD2_SELF: "+2",
      ADD1_SELF: "+1",
      PEEK_NEXT: "PEEK",
      BJ_PROTECTOR: "PROTECT",
      FREE_SPLIT: "SPLIT",
      SWAP_ONE: "SWAP",
      DOUBLE_PAYOUT: "x2",
      REMOVE_RANDOM_SELF: "DEL RNG",
      REMOVE_CARD_SELF: "DEL CARD",
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
      MAGIC_JOKER: "JOKER★",
      MYTHIC_COPY_HANDS: "COPY",
    };
    return (m[id] ?? id).slice(0, 12);
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
          applyTablePayload(data);
          return;
        }
        // If seating fails (e.g. full), fall back to spectate.
        const res2 = await fetch(`/api/blackjack/tables/${safeTableId}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spectate: true }),
        });
        const data2 = (await res2.json().catch(() => ({}))) as any;
        if (res2.ok && data2?.state) applyTablePayload(data2);
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
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      if (cancelled) return;
      const visible = typeof document === "undefined" ? true : document.visibilityState === "visible";
      const wait = visible ? 5000 : 15000;
      clearTimer();
      timer = window.setTimeout(() => {
        void tick();
      }, wait);
    };

    const tick = async () => {
      if (cancelled) return;
      await refreshGlobalChat();
      schedule();
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        clearTimer();
        void tick();
      }
    };

    try {
      document.addEventListener("visibilitychange", onVisibilityChange);
    } catch {
      // ignore
    }
    void tick();
    return () => {
      cancelled = true;
      clearTimer();
      try {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      } catch {
        // ignore
      }
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
    setBetPending(true);
    void (async () => {
      const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
      if ("error" in started) {
        setBetPending(false);
        return;
      }
      const res = await post("bet", { amount: wager, betNonce: started.nonce, allIn });
      if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
      setBetPending(false);
    })();
  }, [state?.phase, state?.round, mySeat?.bet, betPending, reserveServerBet, cancelServerBet, allIn, balance]);

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
    void (async () => {
      const settlements = state.lastResult?.settlements ?? [];
      for (const st of settlements) {
        const nonce = Number(st.nonce);
        if (!Number.isFinite(nonce) || nonce < 0) continue;
        await settleServerBet({
          nonce,
          multiplier: Number(st.multiplier ?? 0),
          outcome: String(st.outcome ?? "Settled"),
        });
      }
      const pp = state.lastResult?.ppSettlements ?? [];
      for (const st of pp) {
        const nonce = Number(st.nonce);
        if (!Number.isFinite(nonce) || nonce < 0) continue;
        await settleServerBet({
          nonce,
          multiplier: Number(st.multiplier ?? 0),
          outcome: String(st.outcome ?? "Perfect Pairs"),
        });
      }
    })();
  }, [state, mySeat, safeTableId, walletSettledKey, settleServerBet]);

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
    const res = await requestTableRoute("join", { spectate: !!spectate, password }, "Failed to join");
    if (!res?.ok) return;
  };

  const post = async (path: string, body?: any) => {
    return requestTableRoute(path, body, "Action failed");
  };

  const postBond = async (body?: any) => {
    return requestTableRoute("bond", body ?? {}, "Bond action failed");
  };

  const postCollectible = async (body?: any) => {
    return requestTableRoute("collectibles", body ?? {}, "Collectibles action failed");
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
    const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
    if ("error" in started) {
      setErr(started.error);
      return;
    }
    setBetPending(true);
    const res = await post("bet", { amount: wager, betNonce: started.nonce, allIn });
    setBetPending(false);
    // If server rejected, refund the reserved wallet bet immediately.
    if (!res?.ok) {
      await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
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
    const started = await reserveServerBet({ game: "Blackjack PP", wager });
    if ("error" in started) {
      setErr(started.error);
      return;
    }
    setBetPending(true);
    const res = await post("perfectpairs", { amount: wager, betNonce: started.nonce });
    setBetPending(false);
    if (!res?.ok) {
      await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
    }
  };

  const clearPerfectPairsWithWallet = async () => {
    if (state?.phase !== "betting") return;
    if (betPending) return;
    const nonce = Number((mySeat as any)?.hands?.[0]?.perfectPairsNonce ?? 0);
    setBetPending(true);
    const res = await post("clearperfectpairs");
    if (res?.ok && Number.isFinite(nonce) && nonce >= 0) {
      await cancelServerBet({ nonce, outcome: "Bet canceled" });
    }
    setBetPending(false);
  };

  const clearBetWithWallet = async () => {
    if (state?.phase !== "betting") return;
    if (betPending) return;
    const nonces: number[] = ((mySeat as any)?.hands?.[0]?.nonces ?? []).filter((x: any) => Number.isFinite(x) && x >= 0);
    setBetPending(true);
    const res = await post("clearbet");
    if (res?.ok) {
      for (const n of nonces) {
        await cancelServerBet({ nonce: n, outcome: "Bet canceled" });
      }
    }
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
      {gameActive && !tableEditMode && !showV2Shell ? (
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

      <BlackjackCollectiblesPanel
        open={collectiblesOpen}
        tableEditMode={tableEditMode}
        bonusPointsBalance={bonusPointsBalance}
        allInWinStreak={allInWinStreak}
        newFigOpen={newFigOpen}
        newFigUrl={newFigUrl}
        newFigBusy={newFigBusy}
        ownedCollectibles={ownedCollectibles}
        figurines={figurines}
        onClose={() => {
          setCollectiblesOpen(false);
          setTableEditMode(false);
          setNewFigOpen(false);
          setNewFigUrl("");
        }}
        onEnterTableEdit={() => {
          setCollectiblesOpen(false);
          setTableEditMode(true);
        }}
        onOpenNewFig={() => setNewFigOpen(true)}
        onCloseNewFig={() => {
          setNewFigOpen(false);
          setNewFigUrl("");
        }}
        onChangeNewFigUrl={setNewFigUrl}
        onCreateFigurine={async () => {
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
        onSellEmoji={async (key) => {
          const ok = window.confirm("Sell 1 emoji collectible for +5 bonus points?");
          if (!ok) return;
          await postCollectible({ action: "sell_emoji", key });
        }}
        onSellFigurine={async (figurineId) => {
          const ok = window.confirm("Sell this figurine for +15 bonus points?");
          if (!ok) return;
          await postCollectible({ action: "sell_figurine", figurineId });
        }}
      />

      <BlackjackTableEditInventory
        open={tableEditMode && gameActive}
        ownedCollectibles={ownedCollectibles}
        figurines={figurines}
        onExit={() => {
          setTableEditMode(false);
          setDragId(null);
        }}
        onOpenInventory={() => setCollectiblesOpen(true)}
        onPlaceEmoji={async (key) => {
          await postCollectible({ action: "place_emoji", key, x: 0.5, y: 0.55 });
        }}
        onPlaceFigurine={async (figurineId) => {
          await postCollectible({ action: "place_figurine", figurineId, x: 0.5, y: 0.55 });
        }}
      />

      {/* Floating chat bubble (bottom-left) */}
      {!tableEditMode && !showV2Shell ? (
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

      <BlackjackHostPanel
        open={hostOpen}
        hostSaving={hostSaving}
        hostTurnMs={hostTurnMs}
        hostAfkKick={hostAfkKick}
        hostDisabled={hostDisabled}
        hostPasswordEnabled={hostPasswordEnabled}
        hostPassword={hostPassword}
        onClose={() => setHostOpen(false)}
        onChangeTurnMs={setHostTurnMs}
        onChangeAfkKick={setHostAfkKick}
        onToggleDisabled={(category, value) => setHostDisabled((m) => ({ ...m, [category]: value }))}
        onChangePasswordEnabled={setHostPasswordEnabled}
        onChangePassword={setHostPassword}
        onSave={async () => {
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
      />

      <BlackjackChatPanel
        open={chatOpen}
        scope={chatScope}
        setScope={setChatScope}
        roomMessages={chatMessages}
        globalMessages={globalChat.messages}
        globalOnline={globalChat.online}
        globalActive1h={globalChat.active1h}
        chatText={chatText}
        setChatText={setChatText}
        experience={experience}
        onClose={() => setChatOpen(false)}
        onRefreshGlobal={refreshGlobalChat}
        onSendRoomMessage={async (text) => {
          await post("chat", { text });
        }}
        onSendGlobalMessage={async (text) => {
          await fetch("/api/chat/global", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });
        }}
      />

      <BlackjackInviteModal
        open={inviteOpen}
        inviteUrl={inviteUrl}
        inviteCopied={inviteCopied}
        experience={experience}
        onClose={() => {
          setInviteOpen(false);
          setInviteCopied(false);
        }}
        onCopy={async () => {
          if (!inviteUrl) return;
          try {
            await navigator.clipboard.writeText(inviteUrl);
            setInviteCopied(true);
            window.setTimeout(() => setInviteCopied(false), 1500);
          } catch {
            // ignore
          }
        }}
        onOpenLink={() => {
          if (!inviteUrl) return;
          window.open(inviteUrl, "_blank", "noopener,noreferrer");
        }}
      />

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
                    onClick={() => {
                      if (bondOwned <= 0) return;
                      setBondPopup({ open: true, mode: "choose_amount" });
                    }}
                  >
                    Activate Bond
                  </button>
                </div>
              </div>
            ) : bondPopup.mode === "choose_amount" ? (
              <div className="mt-4 rounded-2xl border border-yellow-300/15 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                <div className="font-semibold">Choose Bond Amount</div>
                <div className="mt-1 text-xs text-yellow-100/70">
                  Pick a percentage of your current balance:
                  <span className="ml-1 font-mono text-yellow-100">{Number(balance ?? 0).toFixed(2)} ⓒ</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {bondAmountPercents.map((pct) => {
                    const amt = Math.round(Number(balance ?? 0) * (pct / 100) * 100) / 100;
                    return (
                      <button
                        key={pct}
                        type="button"
                        disabled={bondOwned <= 0 || !(amt > 0) || amt > Number(balance ?? 0)}
                        className="glass-soft rounded-2xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-3 text-left text-sm font-semibold text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-40"
                        onClick={async () => {
                          if (!(amt > 0)) {
                            setErr("Not enough chips.");
                            return;
                          }
                          if (amt > Number(balance ?? 0)) {
                            setErr("Not enough chips.");
                            return;
                          }
                          setErr(null);
                          const spend = await adjustServerBalance({
                            delta: -amt,
                            game: "Blackjack Bond",
                            outcome: "Bond activated",
                          });
                          if ("error" in spend) {
                            setErr(spend.error);
                            return;
                          }
                          const bondRes = await postBond({ type: "activate", amount: amt });
                          if (!bondRes?.ok) {
                            await adjustServerBalance({
                              delta: amt,
                              game: "Blackjack Bond",
                              outcome: "Bond activation refunded",
                            });
                            return;
                          }
                          setBondPopup({ open: false, mode: "inactive" });
                        }}
                      >
                        <div>{pct}%</div>
                        <div className="mt-1 font-mono text-xs text-yellow-100/70">{amt.toFixed(2)} ⓒ</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setBondPopup({ open: true, mode: "inactive" })}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setBondPopup({ open: false, mode: "inactive" })}
                  >
                    Cancel
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
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="glass-soft rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15"
                    onClick={async () => {
                      const redeemed = Math.max(0, Math.round(Number(bondActive?.value ?? 0) * 100) / 100);
                      const res = await postBond({ type: "redeem" });
                      if (!res?.ok) return;
                      const amt = Math.max(0, Math.round(Number(res.data?.redeemedAmount ?? redeemed) * 100) / 100);
                      await adjustServerBalance({
                        delta: amt,
                        game: "Blackjack Bond",
                        outcome: "Bond redeemed",
                      });
                      setBondPopup({ open: false, mode: "inactive" });
                    }}
                  >
                    Redeem Bond
                  </button>
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => setBondPopup({ open: false, mode: "inactive" })}
                  >
                    Close
                  </button>
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
        show={!showV2Shell && !!state && !!mySeat}
        isMyTurn={!!isMyTurn}
        myBet={Number(mySeat?.bet ?? 0)}
        handIndex={myHandIndex}
        handCount={myHandCount}
        hands={myHands}
        timerLabel={timerLabel ?? undefined}
        timerSeconds={typeof timerSeconds === "number" ? timerSeconds : undefined}
        onTimerClick={() => {
          const phase = state?.phase;
          if (phase === "betting") {
            scrollToSection(roundControlsRef.current);
            return;
          }
          if (phase === "dealer_window") {
            scrollToSection(dealerPowerupsRef.current);
            return;
          }
          // "Play phase" (player_turns / dealer / settling) -> card/table view
          scrollToSection(tableViewRef.current);
        }}
        canSplit={canSplit}
        canHit={!mySeat?.busted}
        canDoubleDown={canDoubleDown}
        canExtend={true}
        extendUsed={!!mySeat?.extendUsedThisTurn}
        onHit={() => post("action", { type: "hit" })}
        onStand={() => post("action", { type: "stand" })}
        onDoubleDown={async () => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          const res = await post("action", { type: "double_down", betNonce: started.nonce });
          if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
        }}
        onSplit={async () => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          const res = await post("action", { type: "split", betNonce: started.nonce });
          if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
        }}
        onExtend={() => post("action", { type: "extend_timer" })}
        dealerCards={state?.dealer?.cards ?? []}
        dealerBonusPoints={Number((state as any)?.dealer?.bonusPoints ?? 0)}
        myCards={mySeat?.cards ?? []}
        myBonusPoints={Number((myHands as any)?.[myHandIndex]?.bonusPoints ?? (mySeat as any)?.bonusPoints ?? 0)}
      />

      <BlackjackV2StatusStrip
        visible={showV2Shell && v2HeaderVisible}
        phase={String(state?.phase ?? "-")}
        timerLabel={state?.phase === "betting" ? "Betting window" : state?.phase === "player_turns" ? "Turn clock" : state?.phase === "dealer_window" ? "Dealer lane" : "Live state"}
        timerSeconds={state?.phase === "betting" ? bettingLeft : state?.phase === "player_turns" ? turnLeft : state?.phase === "dealer_window" ? dealerLeft : undefined}
        seatCount={Number(tableMeta?.seatCount ?? state?.seats?.filter(Boolean).length ?? 0)}
        spectatorCount={Number(tableMeta?.spectatorCount ?? state?.spectators?.length ?? 0)}
        isHost={!!isHost}
        isMyTurn={!!isMyTurn}
        unreadChat={unreadChat}
        onOpenChat={() => setChatOpen(true)}
        onOpenCollectibles={() => setCollectiblesOpen(true)}
        onOpenHost={() => setHostOpen(true)}
        onOpenControls={() => scrollToSection(roundControlsRef.current)}
      />
      <BlackjackV2OverviewPanel
        visible={showV2Shell && v2HeaderVisible}
        seated={!!mySeat}
        spectating={!!isSpectator}
        phase={String(state?.phase ?? "-")}
        round={Number(state?.round ?? 0)}
        dealerTotal={dealerTotal}
        myTotal={myLiveTotal}
        myBet={mySeat ? Number(mySeat.bet ?? 0) : null}
        unreadChat={unreadChat}
        onJumpToControls={() => scrollToSection(roundControlsRef.current)}
        onJumpToTable={() => scrollToSection(tableViewRef.current)}
        onJoinSeat={() => {
          void join(false);
        }}
        onJoinSpectate={() => {
          void join(true);
        }}
      />
      <BlackjackV2FloatingTimer
        visible={showV2Shell && !!state}
        label={
          state?.phase === "betting"
            ? "Betting window"
            : state?.phase === "player_turns"
              ? "Turn clock"
              : state?.phase === "dealer_window"
                ? "Dealer lane"
                : "Round live"
        }
        seconds={
          state?.phase === "betting"
            ? bettingLeft
            : state?.phase === "player_turns"
              ? turnLeft
              : state?.phase === "dealer_window"
                ? dealerLeft
                : undefined
        }
        phase={String(state?.phase ?? "-")}
      />
      <BlackjackTableHeader
        visible={showV2Shell ? v2HeaderVisible : classicHeaderVisible}
        tableName={state?.name ?? "Blackjack Table"}
        tableId={safeTableId ?? "-"}
        round={Number(state?.round ?? 0)}
        phase={String(state?.phase ?? "-")}
        lobbyHref={lobbyHref}
        experience={experience}
        err={err}
        onOpenInvite={() => setInviteOpen(true)}
        onLeave={() => {
          void post("leave");
        }}
      />

      <BlackjackTurnActionBar
        visible={!!(!showV2Shell && state && mySeat && isMyTurn)}
        myHandIndex={myHandIndex}
        myHandCount={myHandCount}
        turnLeft={turnLeft}
        canDoubleDown={!!canDoubleDown}
        canSplit={!!canSplit}
        extendUsed={!!mySeat?.extendUsedThisTurn}
        busted={!!mySeat?.busted}
        onHit={() => {
          void post("action", { type: "hit" });
        }}
        onStand={() => {
          void post("action", { type: "stand" });
        }}
        onDoubleDown={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Arcade Blackjack", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "double_down", betNonce: started.nonce });
        }}
        onSplit={() => {
          const wager = Number(mySeat?.bet ?? 0);
          const started = beginBet({ game: "Arcade Blackjack", wager });
          if ("error" in started) {
            setErr(started.error);
            return;
          }
          void post("action", { type: "split", betNonce: started.nonce });
        }}
        onVoteSkip={() => {
          void post("action", { type: "vote_skip" });
        }}
        onExtend={() => {
          void post("action", { type: "extend_timer" });
        }}
      />

      {!state ? (
        <div className="glass-soft rounded-3xl p-5 text-white/70">
          {err ? (
            <>
              <div className="text-sm font-semibold text-rose-200">{err}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={lobbyHref}
                  className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                >
                  {showV2Shell ? "Return to V2 lobby" : "Return to lobby"}
                </Link>
              </div>

            </>
          ) : (
            showV2Shell ? "Loading V2 table surface…" : "Loading…"
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${!horizontalMode ? (showV2Shell ? "xl:grid-cols-[minmax(0,1.15fr)_360px]" : "lg:grid-cols-[360px_1fr]") : ""}`}>
          {horizontalMode && hControlsOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-[83] cursor-default bg-black/80"
              onClick={() => setHControlsOpen(false)}
              aria-label="Close controls"
            />
          ) : null}
          <div
            ref={roundControlsRef}
            className={
              horizontalMode
                ? hControlsOpen
                  ? "fixed left-1/2 top-1/2 z-[84] w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass-soft glass-shine rounded-3xl p-5"
                  : "hidden"
                : `glass-soft glass-shine rounded-3xl p-5 ${showV2Shell ? "order-2 xl:order-2" : ""}`
            }
            data-tour="bj-round-controls"
          >
            {showV2Shell ? (
              <BlackjackV2SectionHeader
                eyebrow="Controls"
                title="Betting, inventory, and round tools"
                subtitle="Manage wagers, side bets, powerups, bonds, and host options from one control rail."
              />
            ) : null}
            {horizontalMode ? (
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                  onClick={() => setHControlsOpen(false)}
                >
                  Close
                </button>
              </div>
            ) : null}
            {!showV2Shell ? <p className="text-sm font-medium text-white">Round controls</p> : null}
            <div className="mt-3 text-xs text-white/60">
            {state.phase === "betting" ? (
                <>{roundStatusLabel} <span className="font-mono text-white/80">{bettingLeft}s</span></>
              ) : state.phase === "player_turns" ? (
              <>
                {roundStatusLabel} <span className="font-mono text-white/80">{turnLeft}s</span>
                {turnHandCount > 1 ? (
                  <span className="ml-2 text-[11px] text-white/55">
                    (Hand {turnHandIndex + 1}/{turnHandCount})
                  </span>
                ) : null}
              </>
              ) : state.phase === "dealer_window" ? (
                <>{roundStatusLabel} <span className="font-mono text-white/80">{dealerLeft}s</span></>
              ) : (
                <>{roundStatusLabel}</>
              )}
            </div>

            {mySeat ? (
              <>
                {state.phase === "betting" ? (
                  <>
                    {showV2Shell ? (
                      <>
                        <BlackjackV2ControlCard
                          title="Main bet"
                          subtitle="Lock your main stake for the next hand, go all-in, or sit this hand out before dealing starts."
                        >
                          <label className="block text-xs text-white/60">Main stake (ⓒ)</label>
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
                              Lock stake
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
                              Reset stake
                            </button>
                            <button
                              type="button"
                              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                              onClick={async () => {
                                const nonces: number[] = ((mySeat as any)?.hands?.[0]?.nonces ?? []).filter(
                                  (x: any) => Number.isFinite(x) && x >= 0,
                                );
                                const res = await post("skip");
                                if (res?.ok) {
                                  for (const n of nonces) await cancelServerBet({ nonce: n, outcome: "Bet canceled" });
                                }
                                setAllIn(false);
                              }}
                            >
                              Sit out hand
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
                        </BlackjackV2ControlCard>

                        <BlackjackV2ControlCard
                          title="Perfect Pairs"
                          subtitle="Optional side stake that pays from your first two cards."
                        >
                          <label className="block text-xs text-white/60">Perfect Pairs stake (ⓒ)</label>
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
                              Lock side stake
                            </button>
                            <button
                              type="button"
                              disabled={betPending || (mySeat as any)?.hands?.[0]?.perfectPairsNonce == null}
                              className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                              onClick={clearPerfectPairsWithWallet}
                            >
                              Reset side stake
                            </button>
                          </div>
                        </BlackjackV2ControlCard>
                      </>
                    ) : (
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
                              const nonces: number[] = ((mySeat as any)?.hands?.[0]?.nonces ?? []).filter(
                                (x: any) => Number.isFinite(x) && x >= 0,
                              );
                              const res = await post("skip");
                              if (res?.ok) {
                                for (const n of nonces) await cancelServerBet({ nonce: n, outcome: "Bet canceled" });
                              }
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
                    )}
                  </>
                ) : null}

                {showV2Shell && state.phase !== "betting" ? (
                  <BlackjackV2ControlCard
                    title="Live controls"
                    subtitle="In-round actions now live in the same control slot that betting uses before the deal."
                  >
                    <div className="text-[11px] text-white/60">
                      {state.phase === "player_turns" ? (
                        <>
                          {roundStatusLabel} <span className="font-mono text-white/80">{turnLeft}s</span>
                          {turnHandCount > 1 ? (
                            <span className="ml-2 text-[11px] text-white/55">
                              (Hand {turnHandIndex + 1}/{turnHandCount})
                            </span>
                          ) : null}
                        </>
                      ) : state.phase === "dealer_window" ? (
                        <>
                          {roundStatusLabel} <span className="font-mono text-white/80">{dealerLeft}s</span>
                        </>
                      ) : (
                        <>{roundStatusLabel}</>
                      )}
                    </div>
                    {mySeat ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <div
                          className={`rounded-2xl border px-3 py-2 text-xs ${
                            mySeat?.busted
                              ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                              : (myLiveTotal ?? 0) >= 21
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                : "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-wide opacity-70">Your total</div>
                          <div className="mt-1 font-mono text-sm font-semibold">{myLiveTotal ?? 0}</div>
                        </div>
                        <div
                          className={`rounded-2xl border px-3 py-2 text-xs ${
                            Number(mySeat.bet ?? 0) > 0
                              ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                              : "border-white/10 bg-white/5 text-white/75"
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-wide opacity-70">Stake</div>
                          <div className="mt-1 font-mono text-sm font-semibold">{Number(mySeat.bet ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    ) : null}
                    {isMyTurn ? (
                      <>
                        {mySeat?.busted ? (
                          <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                            BUSTED — play a save card (-1/-2/-5/-10) before your turn ends, or Stand to accept bust.
                          </div>
                        ) : null}
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
                            onClick={async () => {
                              const wager = Number(mySeat?.bet ?? 0);
                              const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                              if ("error" in started) {
                                setErr(started.error);
                                return;
                              }
                              const res = await post("action", { type: "double_down", betNonce: started.nonce });
                              if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
                            }}
                            disabled={!canDoubleDown}
                            title="Double your bet, draw one card, and stand"
                          >
                            DD
                          </button>
                          <button
                            type="button"
                            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                            onClick={async () => {
                              const wager = Number(mySeat?.bet ?? 0);
                              const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                              if ("error" in started) {
                                setErr(started.error);
                                return;
                              }
                              const res = await post("action", { type: "split", betNonce: started.nonce });
                              if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
                            }}
                            disabled={!canSplit}
                            title="Split (up to 4 hands). If your cards don't match, requires FREE_SPLIT."
                          >
                            Split hand
                          </button>
                          <button
                            type="button"
                            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                            onClick={() => post("action", { type: "vote_skip" })}
                            title="Skip the remaining turn timer"
                          >
                            Skip timer vote
                          </button>
                          <button
                            type="button"
                            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                            onClick={() => post("action", { type: "extend_timer" })}
                            disabled={!!mySeat?.extendUsedThisTurn}
                            title="Extend your turn timer once"
                          >
                            Add turn time
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                        {state.phase === "dealer_window"
                          ? "Dealer tools stay live during the dealer response window. Use cards and bond actions below if available."
                          : state.phase === "player_turns"
                            ? "The round is live. Use chat, felt items, bonds, and powerups below while you wait for your turn."
                            : "The hand is resolving. Watch the felt or get ready for the next betting window."}
                      </div>
                    )}
                  </BlackjackV2ControlCard>
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
                  {showV2Shell ? (
                    <BlackjackV2ControlCard
                      title="Cards, boosts, and bonds"
                      subtitle="Use turn cards, dealer tools, and active bond controls from one V2 action panel."
                    >
                      {!showV2Shell ? <p className="text-xs font-medium text-white/70">Specials</p> : null}
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
                                            <div className="flex min-w-0 items-center gap-1.5 font-semibold text-white">
                                              <PowerupStickerIcon id={k} className="text-white/90" />
                                              <span className="truncate">{powerupLabel(k)}</span>
                                            </div>
                                            <div className="font-mono text-white/60">{v}</div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>

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
                    </BlackjackV2ControlCard>
                  ) : null}
                  {!showV2Shell ? (
                  <p className="text-xs font-medium text-white/70">{showV2Shell ? "Classic specials" : "Specials"}</p>
                  ) : null}
                  {!showV2Shell && state.meInventory ? (
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
                  {!showV2Shell && Array.isArray(state.meInventory?.lastBox) && state.meInventory.lastBox.length ? (
                    <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                      Mystery Box: <span className="font-mono">{state.meInventory.lastBox.join(", ")}</span>
                    </div>
                  ) : null}
                  {/* Target is selected only when needed (via the popup). */}
                  {!showV2Shell && (() => {
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
                                        <div className="flex min-w-0 items-center gap-1.5 font-semibold text-white">
                                          <PowerupStickerIcon id={k} className="text-white/90" />
                                          <span className="truncate">{powerupLabel(k)}</span>
                                        </div>
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
                  {!showV2Shell ? (
                  <div className="mt-2 text-[11px] text-white/50">
                    Common cards usually work only on your turn. Rare “TARGET” / “MAGIC” cards can be played any time before the end of the round.
                    Stacking is allowed. Use “-1/-2/-5/-10” on your turn to save yourself from bust before your turn ends.
                  </div>
                  ) : null}
                </div>

                {isMyTurn ? (
                  !showV2Shell ? (
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
                          onClick={async () => {
                            const wager = Number(mySeat?.bet ?? 0);
                            const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                            if ("error" in started) {
                              setErr(started.error);
                              return;
                            }
                            const res = await post("action", { type: "double_down", betNonce: started.nonce });
                            if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
                          }}
                          disabled={!canDoubleDown}
                          title="Double your bet, draw one card, and stand"
                        >
                          DD
                        </button>
                        <button
                          type="button"
                          className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                          onClick={async () => {
                            const wager = Number(mySeat?.bet ?? 0);
                            const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                            if ("error" in started) {
                              setErr(started.error);
                              return;
                            }
                            const res = await post("action", { type: "split", betNonce: started.nonce });
                            if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
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
                  ) : null
                ) : null}

                <div className="mt-4 text-[11px] text-white/55">
                  {showV2Shell ? "AFK risk" : "Missed rounds"}: <span className="font-mono">{mySeat.missedRounds}</span>/5
                </div>
              </>
            ) : showV2Shell ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">
                Join or spectate from the V2 overview panel above, then come back here for betting and inventory tools.
              </div>
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

          <div ref={tableViewRef} className={`glass-soft glass-shine rounded-3xl p-5 ${showV2Shell ? "order-1 xl:order-1" : ""}`}>
            {showV2Shell ? (
              <BlackjackV2SectionHeader
                eyebrow="Surface"
                title="Live felt, dealer lane, and player seats"
                subtitle="Stay on the live surface first, then jump back to controls only when you need to place stakes or use tools."
              />
            ) : null}
            {!showV2Shell ? <p className="text-sm font-medium text-white">Table</p> : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">{showV2Shell ? "Surface mode" : "View"}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-1.5 text-xs ${
                    tableView === "table" ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                  }`}
                  onClick={() => {
                    try {
                      localStorage.setItem(tableViewStorageKey, "table");
                    } catch {}
                    setTableView("table");
                  }}
                >
                  {showV2Shell ? "Live felt" : "Table"}
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-1.5 text-xs ${
                    tableView === "list" ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                  }`}
                  onClick={() => {
                    try {
                      localStorage.setItem(tableViewStorageKey, "list");
                    } catch {}
                    setTableView("list");
                  }}
                >
                  {showV2Shell ? "Seat rail" : "List"}
                </button>
              </div>
            </div>

            {tableView === "list" ? (
              <div className="mt-4">
                <p className="text-xs text-white/60">{showV2Shell ? "Dealer lane" : "Dealer"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.dealer.cards.map((c, i) => (
                    <CardView key={i} idx={c} hidden={c < 0} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/55">
                  {showV2Shell ? "Showing total" : "Visible total"}: <span className="font-mono text-white/80">{dealerTotal}</span>
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
              <p className="text-xs text-white/60">{showV2Shell ? "Players at the table" : "Seats"}</p>
              {tableView === "list" ? (
                <div className="mt-2 grid grid-cols-1 gap-3">
                  {state.seats.map((p, i) => (
                    <BlackjackTableSeat
                      key={i}
                      seatIndex={i}
                      seat={p as any}
                      className=""
                      variant="list"
                      isTurn={state?.phase === "player_turns" && myTurnSeat === i}
                      experience={experience}
                      currentUserId={user?.id ?? null}
                      currentUserNameColor={((user as any)?.name_color ?? null) as string | null}
                      currentUserPrestigeLevel={Number((user as any)?.prestige_level ?? 0)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <div className={`relative mx-auto w-full max-w-[640px] ${isMobile ? "origin-top scale-[0.88]" : ""}`}>
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
                              <div className="text-3xl">{blackjackCollectibleLabel(String(d.key ?? ""))}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="lgc-felt mx-auto h-[560px] w-full rounded-[48px] border border-white/10 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-black/25 shadow-[0_40px_120px_rgba(0,0,0,.45)]" />
                    <div className="pointer-events-none absolute inset-0 rounded-[48px] ring-1 ring-white/10" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[480px] w-[320px] rounded-[999px] border border-white/10 bg-gradient-to-b from-emerald-500/12 to-black/20" />
                    </div>

                    <div className="absolute left-1/2 top-8 w-[360px] -translate-x-1/2">
                      <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-white/80">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-semibold text-white/85">
                          {showV2Shell ? "Dealer lane" : "Dealer"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-white/70">
                          {showV2Shell ? "Showing" : "Visible"} <span className="font-mono text-white/85">{dealerTotal}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {state.dealer.cards.map((c, i) => (
                          <CardView key={i} idx={c} hidden={c < 0} />
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const leftTops = [92, 182, 272, 362, 452];
                      const rightTops = [104, 194, 284, 374, 464];
                      return state.seats.map((p, i) => {
                        const isLeft = i % 2 === 0;
                        const rank = Math.floor(i / 2);
                        const topPx = isLeft ? leftTops[rank] ?? 452 : rightTops[rank] ?? 464;
                        return (
                          <div key={i} className={`absolute ${isLeft ? "left-4" : "right-4"} w-[260px]`} style={{ top: topPx }}>
                            <BlackjackTableSeat
                              seatIndex={i}
                              seat={p as any}
                              className=""
                              variant="table"
                              isTurn={state?.phase === "player_turns" && myTurnSeat === i}
                              experience={experience}
                              currentUserId={user?.id ?? null}
                              currentUserNameColor={((user as any)?.name_color ?? null) as string | null}
                              currentUserPrestigeLevel={Number((user as any)?.prestige_level ?? 0)}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {isMobile ? (
                    <div className="mt-2 text-[11px] text-white/45">
                      {showV2Shell ? "Tip: switch to Seat list for a clearer mobile read." : "Tip: switch to List view if this feels too small."}
                    </div>
                  ) : null}
                </div>
              )}
              <div className="mt-3 text-xs text-white/55">
                {showV2Shell ? "Watching live" : "Spectators"}: <span className="font-mono">{state.spectators.length}</span>
              </div>
            </div>
          </div>
        {/* keep grid open for horizontal fixed overlays */}

        {horizontalMode ? (
          <>
            {/* Horizontal UI: minimized side controls */}
            <div className="pointer-events-none fixed inset-y-0 left-3 z-[82] flex items-center">
              <div className="pointer-events-auto flex flex-col gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                  onClick={() => setHControlsOpen(true)}
                >
                  Controls
                </button>
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                  onClick={() => setChatOpen(true)}
                >
                  Chat
                </button>
              </div>
            </div>
            <div className="pointer-events-none fixed inset-y-0 right-3 z-[82] flex items-center">
              <div className="pointer-events-auto flex flex-col gap-2">
                <button
                  type="button"
                  className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                  onClick={() => setHControlsOpen(true)}
                >
                  Powerups
                </button>
                {isHost ? (
                  <button
                    type="button"
                    className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                    onClick={() => setHostOpen(true)}
                  >
                    Host
                  </button>
                ) : null}
                <button
                  type="button"
                  className="glass-soft rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                  onClick={() => setHMenuOpen(true)}
                >
                  Menu
                </button>
              </div>
            </div>

            {/* Horizontal UI: persistent stake dock (only when seated + no stake locked) */}
            {showHorizontalStakeDock ? (
              <div className="pointer-events-none fixed bottom-4 left-1/2 z-[84] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white/90">Stake window</div>
                      <div className="mt-1 text-[11px] text-white/60">Visible until you lock a stake for this hand.</div>
                    </div>
                    <button
                      type="button"
                      className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                      onClick={() => setHControlsOpen(true)}
                      title="Open full controls"
                    >
                      More
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="w-full">
                      <label className="block text-[11px] text-white/60">Stake (ⓒ)</label>
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`glass-soft rounded-2xl px-4 py-2 text-sm font-semibold hover:bg-white/10 ${
                          allIn ? "border border-yellow-300/25 bg-yellow-500/10 text-yellow-100" : "text-white/85"
                        }`}
                        onClick={() => setAllIn((v) => !v)}
                        title="Stake your full balance"
                      >
                        All in
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-40"
                        disabled={betPending}
                        onClick={placeBetWithWallet}
                      >
                        Lock stake
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {horizontalShowLiveDock ? (
              <div className="pointer-events-none fixed bottom-4 left-1/2 z-[84] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="pointer-events-auto glass glass-shine rounded-3xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white/90">Live controls</div>
                      <div className="mt-1 text-[11px] text-white/60">
                        {state?.phase === "player_turns"
                          ? "Your active round tools now stay in the old stake slot."
                          : state?.phase === "dealer_window"
                            ? "Dealer-window tools stay visible here while the hand resolves."
                            : "This dock keeps only the current round tools on screen."}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="glass-soft rounded-2xl px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                      onClick={() => setHControlsOpen(true)}
                      title="Open full controls"
                    >
                      More
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        mySeat?.busted
                          ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                          : (myLiveTotal ?? 0) >= 21
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                            : "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wide opacity-70">Your total</div>
                      <div className="mt-1 font-mono text-sm font-semibold">{myLiveTotal ?? 0}</div>
                    </div>
                    <div
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        Number(mySeat?.bet ?? 0) > 0
                          ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                          : "border-white/10 bg-white/5 text-white/75"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wide opacity-70">Stake</div>
                      <div className="mt-1 font-mono text-sm font-semibold">{Number(mySeat?.bet ?? 0).toFixed(2)}</div>
                    </div>
                  </div>

                  {isMyTurn ? (
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
                        onClick={async () => {
                          const wager = Number(mySeat?.bet ?? 0);
                          const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                          if ("error" in started) {
                            setErr(started.error);
                            return;
                          }
                          const res = await post("action", { type: "double_down", betNonce: started.nonce });
                          if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
                        }}
                        disabled={!canDoubleDown}
                      >
                        DD
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                        onClick={async () => {
                          const wager = Number(mySeat?.bet ?? 0);
                          const started = await reserveServerBet({ game: "Blackjack (MP)", wager });
                          if ("error" in started) {
                            setErr(started.error);
                            return;
                          }
                          const res = await post("action", { type: "split", betNonce: started.nonce });
                          if (!res?.ok) await cancelServerBet({ nonce: started.nonce, outcome: "Bet canceled" });
                        }}
                        disabled={!canSplit}
                      >
                        Split hand
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                        onClick={() => post("action", { type: "vote_skip" })}
                      >
                        Skip timer vote
                      </button>
                      <button
                        type="button"
                        className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-40"
                        onClick={() => post("action", { type: "extend_timer" })}
                        disabled={!!mySeat?.extendUsedThisTurn}
                      >
                        Add turn time
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                      {state.phase === "dealer_window"
                        ? "Dealer tools can still be played if you have them."
                        : "Only the useful round controls stay here while you wait for your turn."}
                    </div>
                  )}

                  {horizontalApplicablePowerups.length ? (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <div className="mb-2 text-[11px] font-semibold text-white/70">Usable powerups</div>
                      <div className="flex flex-wrap gap-2">
                        {horizontalApplicablePowerups.slice(0, 8).map(([k, v]) => (
                          <button
                            key={k}
                            type="button"
                            className="glass-soft flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                            onClick={() => usePowerupQuick(k)}
                            title={k}
                          >
                            <PowerupStickerIcon id={k} className="text-white/90" />
                            <span>{powerupLabel(k)}</span>
                            <span className="font-mono text-white/60">{v}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Horizontal UI: compact menu */}
            {hMenuOpen ? (
              <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
                <div className="glass glass-shine w-full max-w-[520px] rounded-3xl border border-white/10 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Menu</div>
                      <div className="mt-1 text-xs text-white/60">Quick access while keeping the felt full-screen.</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                      onClick={() => setHMenuOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => { setHMenuOpen(false); setHControlsOpen(true); }}>
                      Controls
                    </button>
                    <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => { setHMenuOpen(false); setChatOpen(true); }}>
                      Chat
                    </button>
                    <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => { setHMenuOpen(false); setCollectiblesOpen(true); }}>
                      Felt items
                    </button>
                    {isHost ? (
                      <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => { setHMenuOpen(false); setHostOpen(true); }}>
                        Host tools
                      </button>
                    ) : (
                      <Link href={lobbyHref} className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => setHMenuOpen(false)}>
                        Back to lobby
                      </Link>
                    )}
                    <button type="button" className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/10" onClick={() => { setHMenuOpen(false); setInviteOpen(true); }}>
                      Share table
                    </button>
                    <button
                      type="button"
                      className="glass-soft rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/15"
                      onClick={() => {
                        setHMenuOpen(false);
                        void post("leave");
                      }}
                    >
                      Exit table
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        </div>
      )}

      <div className="mt-4 text-center text-xs text-white/45">
        Arcade Blackjack game mode inspired by <span className="font-semibold text-white/60">xyzzy’s blackjack</span>
      </div>
    </div>
  );
}

export default function BlackjackTablePage() {
  return <BlackjackTablePageClient routeBase="/casino/blackjack" lobbyHref="/casino/blackjack-v2" experience="classic" />;
}
