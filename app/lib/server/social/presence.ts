import "server-only";

export interface PresenceEntry {
  userId: string;
  username: string;
  location: "lobby" | "blackjack" | "roulette" | "dice" | "slots-5x3" | "slots-5x5" | "slots-10x10";
  locationId?: string;
  lastSeenAt: number;
}

export interface PresenceUpdate {
  userId: string;
  username: string;
  location: PresenceEntry["location"];
  locationId?: string;
  timestamp: number;
}

export function locationLabel(location: PresenceEntry["location"]): string {
  switch (location) {
    case "lobby":
      return "Lobby";
    case "blackjack":
      return "Blackjack";
    case "roulette":
      return "Roulette";
    case "dice":
      return "Dice";
    case "slots-5x3":
      return "Slots 5×3";
    case "slots-5x5":
      return "Slots 5×5";
    case "slots-10x10":
      return "Slots 10×10";
    default:
      return "Unknown";
  }
}

export function sortPresenceByLocation(entries: PresenceEntry[]): Map<string, PresenceEntry[]> {
  const grouped = new Map<string, PresenceEntry[]>();
  for (const entry of entries) {
    const key = entry.location;
    const arr = grouped.get(key) ?? [];
    arr.push(entry);
    grouped.set(key, arr);
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.username.localeCompare(b.username));
  }
  return grouped;
}

export function summarizePresence(entries: PresenceEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.location] = (counts[entry.location] ?? 0) + 1;
  }
  return counts;
}
