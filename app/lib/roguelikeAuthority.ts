import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthedUserAsync } from "./authServer";
import type { RoguelikeRoom } from "./roguelikeRoom";
const name = (code: string) => "lgc_room_" + code.replace(/[^A-Z0-9]/gi, "");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function issueSeat(room: RoguelikeRoom, playerId: string) {
  const player = room.players.find(p => p.playerId === playerId);
  if (!player) throw new Error("Seat not found");
  const token = randomBytes(32).toString("hex");
  player.capabilityHash = hash(token);
  const embedded = process.env.NODE_ENV === "production" && !!process.env.VERCEL;
  (await cookies()).set(name(room.code), token, { httpOnly: true, secure: embedded, sameSite: embedded ? "none" : "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function ownsSeat(room: RoguelikeRoom, playerId: string): Promise<boolean> {
  const player = room.players.find(p => p.playerId === playerId);
  if (!player) return false;
  const user = await getAuthedUserAsync();
  if (player.userId !== null) return !!user && user.id === player.userId;
  const token = (await cookies()).get(name(room.code))?.value;
  if (!token || !player.capabilityHash) return false;
  const actual = Buffer.from(hash(token)), expected = Buffer.from(player.capabilityHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
