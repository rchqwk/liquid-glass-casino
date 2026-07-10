import "server-only";

export type AnnouncementLevel = "info" | "success" | "warning" | "error";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  active: boolean;
  createdAt: number;
  expiresAt: number | null;
  createdByUserId: string;
  createdByUsername: string;
}

export function createAnnouncement(
  id: string,
  title: string,
  body: string,
  level: AnnouncementLevel,
  createdByUserId: string,
  createdByUsername: string,
  now: number,
  expiresInMs?: number | null
): Announcement {
  return {
    id,
    title,
    body,
    level,
    active: true,
    createdAt: now,
    expiresAt: expiresInMs != null ? now + expiresInMs : null,
    createdByUserId,
    createdByUsername,
  };
}

export function isAnnouncementActive(a: Announcement, now: number): boolean {
  if (!a.active) return false;
  if (a.expiresAt != null && now >= a.expiresAt) return false;
  return true;
}

export function formatAnnouncementLevel(level: AnnouncementLevel): string {
  switch (level) {
    case "info":
      return "Information";
    case "success":
      return "Success";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    default:
      return "Notice";
  }
}

export function announcementLevelColor(level: AnnouncementLevel): string {
  switch (level) {
    case "info":
      return "text-blue-300";
    case "success":
      return "text-emerald-300";
    case "warning":
      return "text-amber-300";
    case "error":
      return "text-rose-300";
    default:
      return "text-white";
  }
}

export function announcementLevelBg(level: AnnouncementLevel): string {
  switch (level) {
    case "info":
      return "bg-blue-500/15";
    case "success":
      return "bg-emerald-500/15";
    case "warning":
      return "bg-amber-500/15";
    case "error":
      return "bg-rose-500/15";
    default:
      return "bg-white/10";
  }
}
