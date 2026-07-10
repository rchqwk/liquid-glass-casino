import "server-only";

export type RoleLevel = 0 | 1 | 2 | 3;

export const ROLE_LABELS: Record<RoleLevel, string> = {
  0: "User",
  1: "Moderator",
  2: "Admin",
  3: "Master",
};

export function roleLevel(n: number): RoleLevel {
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

export function roleLabel(n: number): string {
  return ROLE_LABELS[roleLevel(n)];
}

export function canViewAdminPanel(level: number): boolean {
  return level >= 1;
}

export function canModerate(level: number): boolean {
  return level >= 1;
}

export function canWipeUser(level: number): boolean {
  return level >= 2;
}

export function canEditConfig(level: number): boolean {
  return level >= 3;
}

export function canSetRoles(level: number): boolean {
  return level >= 3;
}

export function canApproveProgressReset(level: number): boolean {
  return level >= 1;
}

export function isHiddenFromLeaderboard(level: number): boolean {
  return level >= 1;
}

export interface AdminActionLog {
  id: string;
  action: "set_role" | "wipe_user" | "reset_leaderboard" | "approve_reset" | "update_config";
  actorUserId: string;
  actorUsername: string;
  targetUserId?: string;
  targetUsername?: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export function createAdminActionLog(
  action: AdminActionLog["action"],
  actorUserId: string,
  actorUsername: string,
  details: Record<string, unknown>,
  targetUserId?: string,
  targetUsername?: string
): AdminActionLog {
  return {
    id: `${Date.now()}-${actorUserId}-${action}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    actorUserId,
    actorUsername,
    targetUserId,
    targetUsername,
    details,
    timestamp: Date.now(),
  };
}
