import "server-only";

export type EmoteId =
  | "cheers"
  | "luck"
  | "fold"
  | "taunt"
  | "wow"
  | "gg"
  | "fire"
  | "heart"
  | "think"
  | "cry"
  | "clock"
  | "cash";

export interface EmoteDef {
  id: EmoteId;
  emoji: string;
  label: string;
}

export const EMOTES: EmoteDef[] = [
  { id: "cheers", emoji: "🍻", label: "Cheers" },
  { id: "luck", emoji: "🍀", label: "Good Luck" },
  { id: "fold", emoji: "🏳️", label: "Fold" },
  { id: "taunt", emoji: "😜", label: "Taunt" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "gg", emoji: "🎮", label: "GG" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "heart", emoji: "❤️", label: "Heart" },
  { id: "think", emoji: "🤔", label: "Think" },
  { id: "cry", emoji: "😭", label: "Cry" },
  { id: "clock", emoji: "⏰", label: "Hurry" },
  { id: "cash", emoji: "💰", label: "Cash" },
];

export const EMOTE_MAP: Record<EmoteId, EmoteDef> = Object.fromEntries(
  EMOTES.map((e) => [e.id, e])
) as Record<EmoteId, EmoteDef>;

export interface InFlightEmote {
  id: string;
  emoteId: EmoteId;
  fromUserId: string;
  fromUsername: string;
  fromSeatIndex: number | null;
  targetSeatIndex: number | null;
  createdAt: number;
  expiresAt: number;
}

export function createEmote(
  emoteId: EmoteId,
  fromUserId: string,
  fromUsername: string,
  fromSeatIndex: number | null,
  targetSeatIndex: number | null,
  now: number,
  ttlMs: number = 2500
): InFlightEmote {
  return {
    id: `${now}-${fromUserId}-${emoteId}-${Math.random().toString(36).slice(2, 8)}`,
    emoteId,
    fromUserId,
    fromUsername,
    fromSeatIndex,
    targetSeatIndex,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}
