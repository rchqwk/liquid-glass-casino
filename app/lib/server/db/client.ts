import "server-only";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

export type SqlClient = ReturnType<typeof neon>;

export function resolveDatabaseUrl(): string {
  return (
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

export const useDatabase = resolveDatabaseUrl().length > 0;

export function getSql(): SqlClient | null {
  const url = resolveDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

const STORE_PATH = (() => {
  const hasDb = useDatabase;
  if (hasDb) return path.join(process.cwd(), "data.json");
  if (process.env.VERCEL) return path.join("/tmp", "lgc-data.json");
  return path.join(process.cwd(), "data.json");
})();

export type PersistedWalletState = {
  balance: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  history: Array<{
    ts: number;
    game: string;
    wager: number;
    multiplier: number;
    profit: number;
    outcome: string;
  }>;
  lastRefill5000At?: number;
  lastRefill100At?: number;
  openBets?: Record<
    number,
    { game: string; wager: number; ts: number; serverSeed: string; clientSeed: string; baseWager?: number }
  >;
  updatedAt?: number;
};

export type JsonStore = {
  nextUserId: number;
  users: Array<Record<string, unknown>>;
  sessions: Array<{ token: string; user_id: number; created_at: number; method?: string }>;
  leaderboard: Array<Record<string, unknown>>;
  game_stats?: Array<Record<string, unknown>>;
  nextGameStatEventId?: number;
  game_stat_events?: Array<Record<string, unknown>>;
  blackjack_tables?: Array<Record<string, unknown>>;
  blackjack_inventories?: Array<Record<string, unknown>>;
  config: Record<string, { value: string; updated_at: number }>;
  nextAnnouncementId?: number;
  announcements?: Array<Record<string, unknown>>;
  nextGlobalChatId?: number;
  global_chat?: Array<Record<string, unknown>>;
  discord_links?: Array<Record<string, unknown>>;
  discord_mobile_auths?: Array<Record<string, unknown>>;
  progress_reset_requests?: Array<Record<string, unknown>>;
  user_wallets?: Array<Record<string, unknown>>;
};

export function defaultJsonStore(): JsonStore {
  return {
    nextUserId: 1,
    users: [],
    sessions: [],
    leaderboard: [],
    game_stats: [],
    nextGameStatEventId: 1,
    game_stat_events: [],
    blackjack_tables: [],
    blackjack_inventories: [],
    config: {},
    nextAnnouncementId: 1,
    announcements: [],
    nextGlobalChatId: 1,
    global_chat: [],
    discord_links: [],
    discord_mobile_auths: [],
    progress_reset_requests: [],
    user_wallets: [],
  };
}

let inMemoryStore: JsonStore | null = null;

function loadStore(): JsonStore {
  if (inMemoryStore) return inMemoryStore;
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    inMemoryStore = { ...defaultJsonStore(), ...(JSON.parse(raw) as JsonStore) };
    return inMemoryStore;
  } catch {
    inMemoryStore = defaultJsonStore();
    return inMemoryStore;
  }
}

function saveStore(store: JsonStore) {
  inMemoryStore = store;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // read-only filesystem (serverless preview) — keep in-memory copy only
  }
}

let locked = false;
const queue: Array<() => void> = [];

export async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  if (locked) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
    const next = queue.shift();
    if (next) next();
  }
}

export async function withStore<T>(fn: (s: JsonStore) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const store = loadStore();
    const out = await fn(store);
    saveStore(store);
    return out;
  });
}

export async function readStore<T>(fn: (s: JsonStore) => T | Promise<T>): Promise<T> {
  return withLock(async () => fn(loadStore()));
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function masterUsername(): string {
  return normalizeUsername(process.env.LGC_MASTER_USERNAME ?? "master");
}
