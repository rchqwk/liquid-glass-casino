import "server-only";
import { sessionsRepo, usersRepo, discordRepo, type AuthedUserWithRole } from "../db";
import { SESSION, canManageRoles } from "../../shared/constants";
import { getSessionToken, newSessionToken } from "./session";

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export type AuthResult = {
  user: AuthedUserWithRole;
  method: string;
};

export async function getAuthedUser(): Promise<AuthedUserWithRole | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await sessionsRepo.getByToken(token);
  if (!session) return null;
  const full = await usersRepo.getFullById(session.user_id);
  if (!full || full.banned) {
    await sessionsRepo.delete(token);
    return null;
  }
  const lastActivity = full.last_seen ?? session.created_at;
  if (Date.now() - lastActivity > SESSION.IDLE_TIMEOUT_MS) {
    await sessionsRepo.delete(token);
    return null;
  }
  await sessionsRepo.touch(token);
  await usersRepo.touchLastSeen(full.id, token);
  return { id: full.id, username: full.username, role_level: full.role_level };
}

export async function requireUser(): Promise<AuthedUserWithRole> {
  const u = await getAuthedUser();
  if (!u) throw new AuthError("unauthenticated", "Not signed in.", 401);
  return u;
}

export async function requireRole(minRole: number): Promise<AuthedUserWithRole> {
  const u = await requireUser();
  if (u.role_level < minRole) {
    throw new AuthError("forbidden", "Insufficient permissions.", 403);
  }
  return u;
}

export async function loginAsUsername(
  username: string,
  fingerprint?: string
): Promise<{ token: string; user: AuthedUserWithRole }> {
  const user = await usersRepo.ensure(username);
  if (fingerprint) {
    const full = await usersRepo.getFullById(user.id);
    const lockedAt = full?.fingerprint_locked_at ?? 0;
    const locked =
      !!full?.fingerprint &&
      full.fingerprint !== fingerprint &&
      Date.now() - lockedAt < SESSION.FINGERPRINT_LOCK_MS;
    if (locked) {
      throw new AuthError(
        "device_locked",
        "This account is locked to another device. Try again later.",
        423
      );
    }
    await usersRepo.setFingerprint(user.id, fingerprint);
  }
  const token = newSessionToken();
  await sessionsRepo.create(user.id, token, "username");
  return { token, user };
}

export async function loginAsDiscord(discordId: string, username: string): Promise<{
  token: string;
  user: AuthedUserWithRole;
}> {
  const existingUserId = await discordRepo.getUserId(discordId);
  const user =
    existingUserId != null
      ? ((await usersRepo.getById(existingUserId)) ?? (await usersRepo.ensure(username)))
      : await usersRepo.ensure(username);
  if (existingUserId == null) await discordRepo.link(discordId, user.id);
  const token = newSessionToken();
  await sessionsRepo.create(user.id, token, "discord_oauth");
  return { token, user };
}

export async function loginAsTempUsername(username: string): Promise<{
  token: string;
  user: AuthedUserWithRole;
}> {
  const user = await usersRepo.ensure(username);
  const token = newSessionToken();
  await sessionsRepo.create(user.id, token, "username");
  return { token, user };
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token) await sessionsRepo.delete(token);
}

export async function setUserRole(
  caller: AuthedUserWithRole,
  targetId: number,
  newRole: number
): Promise<void> {
  if (!canManageRoles(caller.role_level)) {
    throw new AuthError("forbidden", "Only master can manage roles.", 403);
  }
  if (newRole >= 3 && caller.role_level < 3) {
    throw new AuthError("forbidden", "Cannot grant master role.", 403);
  }
  await usersRepo.setRole(targetId, newRole);
}
