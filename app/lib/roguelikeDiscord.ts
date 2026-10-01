import { createHash } from "node:crypto";
import { createRoom, joinRoom, leaveRoom, persistRoomXp, RoomError, updateRoom, type RoguelikeRoom } from "./roguelikeRoom";

export const ACTIVITY_SEAT_TTL = 120_000;

export function discordRoomCode(channelId: string): string {
  if (!/^\d{15,22}$/.test(channelId)) throw new RoomError("A Discord call channel is required.", 400);
  return createHash("sha256").update(`roguelike-discord:${channelId}`).digest("hex").slice(0, 12).toUpperCase();
}

export function activeDiscordRoom(room: RoguelikeRoom | null, now = Date.now()): boolean {
  return !!room?.discordChannelId && room.players.some(p => (p.lastSeenAt ?? 0) > now - ACTIVITY_SEAT_TTL);
}

export async function joinDiscordRoom(channelId: string, user: { id: number; username: string }) {
  const code = discordRoomCode(channelId), playerId = `u${user.id}`;
  let awardXp = false;
  const next = await updateRoom(code, async current => {
    awardXp = false;
    const now = Date.now();
    let room = current;
    if (room && room.discordChannelId !== channelId) throw new RoomError("Activity room mismatch.");
    if (!activeDiscordRoom(room, now)) {
      room = createRoom(code, playerId, user.username, "coop", user.id);
      room.discordChannelId = channelId;
    } else {
      const wasEnded = room!.runEnded;
      for (const player of [...room!.players]) {
        if (player.playerId !== playerId && (player.lastSeenAt ?? 0) <= now - ACTIVITY_SEAT_TTL) leaveRoom(room!, player.playerId);
      }
      const result = joinRoom(room!, playerId, user.username, user.id);
      if (result.error) throw new RoomError(result.error);
      room = result.room;
      awardXp = !wasEnded && room.runEnded && !!room.xp;
    }
    room!.players.find(p => p.playerId === playerId)!.lastSeenAt = now;
    return room!;
  });
  if (awardXp) await persistRoomXp(next);
  return next;
}
