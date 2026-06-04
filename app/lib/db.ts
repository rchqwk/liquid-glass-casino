import fs from "fs";
import path from "path";
import "server-only";
import { neon } from "@neondatabase/serverless";

export type AuthedUser = { id: number; username: string };
export type AuthedUserWithRole = {
  id: number;
  username: string;
  role_level: number;
  prestige_level?: number;
  name_color?: string | null;
};

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

type Store = {
  nextUserId: number;
  users: Array<{
    id: number;
    username: string;
    role_level: number;
    prestige_level?: number;
    name_color?: string | null;
    created_at: number;
    fingerprint?: string;
    active_session_token?: string | null;
    last_seen?: number;
    last_signout?: number;
  }>;
  sessions: Array<{ token: string; user_id: number; created_at: number }>;
  leaderboard: Array<{
    user_id: number;
    profit_total: number;
    wager_total: number;
    bets: number;
    updated_at: number;
    active?: boolean;
  }>;
  game_stats?: Array<{
    game_id: string;
    wager_total: number;
    bets: number;
    updated_at: number;
  }>;
  blackjack_tables?: Array<{
    id: string;
    public: boolean;
    name: string;
    state: any;
    updated_at: number;
    created_at: number;
  }>;
  blackjack_inventories?: Array<{
    user_id: number;
    inventory: any;
    updated_at: number;
  }>;
  config: Record<string, { value: string; updated_at: number }>;
  nextAnnouncementId?: number;
  announcements?: Array<{ id: number; ts: number; message: string }>;
  nextGlobalChatId?: number;
  global_chat?: Array<{ id: number; ts: number; user_id: number; username: string; text: string }>;
  discord_links?: Array<{ discord_id: string; user_id: number; created_at: number }>;
};

const STORE_PATH = (() => {
  // In serverless (Vercel) the project directory is read-only; only /tmp is writable.
  // This fallback store is NOT durable across deploys/instances, but prevents crashes
  // when DATABASE_URL isn't configured yet.
  const hasDb =
    !!process.env.DATABASE_URL ||
    !!process.env.POSTGRES_URL ||
    !!process.env.NEON_DATABASE_URL;
  if (hasDb) return path.join(process.cwd(), "data.json");
  if (process.env.VERCEL) return path.join("/tmp", "lgc-data.json");
  return path.join(process.cwd(), "data.json");
})();

function defaultStore(): Store {
  return {
    nextUserId: 1,
    users: [],
    sessions: [],
    leaderboard: [],
    game_stats: [],
    blackjack_tables: [],
    blackjack_inventories: [],
    config: {},
    nextAnnouncementId: 1,
    announcements: [],
    nextGlobalChatId: 1,
    global_chat: [],
    discord_links: [],
  };
}

// In some serverless environments, the filesystem may be read-only.
// Keep an in-memory copy as a fallback so sequential requests still see the same state.
let inMemoryStore: Store | null = null;

function loadStore(): Store {
  if (inMemoryStore) return inMemoryStore;
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    inMemoryStore = JSON.parse(raw) as Store;
    return inMemoryStore;
  } catch {
    inMemoryStore = defaultStore();
    return inMemoryStore;
  }
}

function saveStore(store: Store) {
  inMemoryStore = store;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // If the filesystem is read-only, skip persistence (serverless fallback).
  }
}

// Simple in-process mutex for dev / single-instance usage.
let locked = false;
const queue: Array<() => void> = [];
async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
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

export async function withStore<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const store = loadStore();
    const out = await fn(store);
    saveStore(store);
    return out;
  });
}

const MASTER_USERNAME = normalizeUsername(process.env.LGC_MASTER_USERNAME ?? "master");

function getSql() {
  // Prefer POSTGRES_URL first (Vercel/Neon integrations often populate it),
  // then NEON_DATABASE_URL, then DATABASE_URL (which may point elsewhere).
  const url =
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";
  if (!url) return null;
  return neon(url);
}

let schemaReady = false;
async function ensureSchema() {
  const sql = getSql();
  if (!sql) return;
  if (schemaReady) return;
  // Neon serverless does not allow multiple SQL commands in one prepared statement.
  // Keep each CREATE TABLE in its own statement.
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      role_level INT NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS leaderboard (
      user_id INT PRIMARY KEY REFERENCES users(id),
      profit_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      wager_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      bets INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      ts BIGINT NOT NULL,
      message TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS global_chat (
      id SERIAL PRIMARY KEY,
      ts BIGINT NOT NULL,
      user_id INT NOT NULL REFERENCES users(id),
      username TEXT NOT NULL,
      text TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS discord_links (
      discord_id TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      created_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS game_stats (
      game_id TEXT PRIMARY KEY,
      wager_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      bets INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blackjack_tables (
      id TEXT PRIMARY KEY,
      public BOOLEAN NOT NULL DEFAULT TRUE,
      name TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blackjack_inventories (
      user_id INT PRIMARY KEY REFERENCES users(id),
      inventory_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;

  // Migrations / new columns
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fingerprint TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_token TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_signout BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_baseline DOUBLE PRECISION NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_baseline_ts BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS prestige_level INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name_color TEXT`;

  await sql`ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  schemaReady = true;
}

export async function createOrGetDiscordLinkedUser(input: { discordId: string; displayName: string }) {
  const discordId = String(input.discordId ?? "").trim();
  if (!discordId) throw new Error("Missing discordId");
  const displayName = normalizeUsername(String(input.displayName ?? "discord_user").slice(0, 32));
  const now = Date.now();
  const sql = getSql();

  if (sql) {
    await ensureSchema();
    const rows = (await sql`SELECT user_id FROM discord_links WHERE discord_id = ${discordId}`) as any[];
    const existingUserId = rows[0]?.user_id;
    if (existingUserId) {
      const urows =
        (await sql`SELECT id, username, role_level FROM users WHERE id = ${Number(existingUserId)}`) as any[];
      const u = urows[0];
      if (u) return { id: Number(u.id), username: String(u.username), role_level: Number(u.role_level ?? 0) };
    }

    // Create a dedicated username in our users table.
    // Ensure uniqueness by suffixing last 6 chars of discordId if needed.
    const base = displayName || "discord_user";
    const suffix = discordId.slice(-6);
    const uname = `${base}_${suffix}`.slice(0, 32);
    await sql`INSERT INTO users (username, role_level, created_at) VALUES (${uname}, 0, ${now}) ON CONFLICT (username) DO NOTHING`;
    const u2 = (await sql`SELECT id, username, role_level FROM users WHERE username = ${uname}`) as any[];
    const user = u2[0];
    if (!user) throw new Error("User create failed");
    await sql`INSERT INTO discord_links (discord_id, user_id, created_at) VALUES (${discordId}, ${user.id}, ${now}) ON CONFLICT (discord_id) DO NOTHING`;
    await sql`UPDATE users SET last_seen = ${now} WHERE id = ${user.id}`;
    return { id: Number(user.id), username: String(user.username), role_level: Number(user.role_level ?? 0) };
  }

  // File-store fallback
  return withStore((s) => {
    s.discord_links = s.discord_links ?? [];
    const existing = s.discord_links.find((l) => l.discord_id === discordId);
    if (existing) {
      const u = s.users.find((x) => x.id === existing.user_id);
      if (u) return { id: u.id, username: u.username, role_level: u.role_level ?? 0 };
    }
    const base = displayName || "discord_user";
    const uname = `${base}_${discordId.slice(-6)}`.slice(0, 32);
    let user: any = s.users.find((x) => x.username === uname);
    if (!user) {
      user = { id: s.nextUserId++, username: uname, role_level: 0, created_at: now } as any;
      s.users.push(user as any);
    }
    (user as any).last_seen = now;
    s.discord_links.push({ discord_id: discordId, user_id: user.id, created_at: now });
    return { id: user.id, username: user.username, role_level: user.role_level ?? 0 };
  });
}

export async function discordSetActiveSession(userId: number, token: string) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE users SET active_session_token = ${token}, last_seen = ${now} WHERE id = ${userId}`;
    await sql`INSERT INTO sessions (token, user_id, created_at) VALUES (${token}, ${userId}, ${now})`;
    return;
  }
  return withStore((s) => {
    const u: any = s.users.find((x) => x.id === userId);
    if (u) {
      u.active_session_token = token;
      u.last_seen = now;
    }
    s.sessions.push({ token, user_id: userId, created_at: now });
  });
}

export async function touchUserLastSeen(userId: number) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE users SET last_seen = ${now} WHERE id = ${userId}`;
    return;
  }
  return withStore((s) => {
    const u: any = s.users.find((x) => x.id === userId);
    if (u) u.last_seen = now;
  });
}

export async function getPresenceCounts() {
  const sql = getSql();
  const now = Date.now();
  const onlineCutoff = now - 2 * 60 * 1000;
  const active1hCutoff = now - 60 * 60 * 1000;
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`
        SELECT
          SUM(CASE WHEN last_seen >= ${onlineCutoff} THEN 1 ELSE 0 END) AS online,
          SUM(CASE WHEN last_seen >= ${active1hCutoff} THEN 1 ELSE 0 END) AS active_1h
        FROM users
      `) as any[];
    return {
      online: Number(rows[0]?.online ?? 0),
      active1h: Number(rows[0]?.active_1h ?? 0),
    };
  }

  return withStore((s) => {
    const users = s.users ?? [];
    const online = users.filter((u: any) => Number(u.last_seen ?? 0) >= onlineCutoff).length;
    const active1h = users.filter((u: any) => Number(u.last_seen ?? 0) >= active1hCutoff).length;
    return { online, active1h };
  });
}

export async function addGlobalChatMessage(input: { userId: number; username: string; text: string }) {
  const sql = getSql();
  const now = Date.now();
  const text = String(input.text ?? "").trim().slice(0, 240);
  const username = String(input.username ?? "user").slice(0, 32);
  if (!text) return;

  if (sql) {
    await ensureSchema();
    await sql`INSERT INTO global_chat (ts, user_id, username, text) VALUES (${now}, ${input.userId}, ${username}, ${text})`;
    // keep last ~24h
    await sql`DELETE FROM global_chat WHERE ts < ${now - 24 * 60 * 60 * 1000}`;
    return;
  }

  return withStore((s) => {
    const id = s.nextGlobalChatId ?? 1;
    s.nextGlobalChatId = id + 1;
    s.global_chat = s.global_chat ?? [];
    s.global_chat.push({ id, ts: now, user_id: input.userId, username, text });
    s.global_chat = s.global_chat.filter((m) => m.ts >= now - 24 * 60 * 60 * 1000).slice(-120);
  });
}

export async function getGlobalChatMessages(limit = 120) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      SELECT id, ts, user_id, username, text
      FROM global_chat
      ORDER BY id DESC
      LIMIT ${limit}
    `) as any[];
    // return ascending for UI
    return rows.reverse().map((r) => ({
      id: String(r.id),
      ts: Number(r.ts ?? 0),
      userId: Number(r.user_id ?? 0),
      username: String(r.username ?? ""),
      text: String(r.text ?? ""),
    }));
  }

  return withStore((s) => {
    const list = (s.global_chat ?? []).slice(-limit);
    return list.map((m) => ({
      id: String(m.id),
      ts: Number(m.ts ?? 0),
      userId: Number(m.user_id ?? 0),
      username: String(m.username ?? ""),
      text: String(m.text ?? ""),
    }));
  });
}

export async function addAnnouncement(message: string) {
  const msg = String(message ?? "").slice(0, 200);
  if (!msg) return;
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`INSERT INTO announcements (ts, message) VALUES (${now}, ${msg})`;
    // cleanup old (24h)
    await sql`DELETE FROM announcements WHERE ts < ${now - 24 * 60 * 60 * 1000}`;
    return;
  }

  return withStore((s) => {
    const id = s.nextAnnouncementId ?? 1;
    s.nextAnnouncementId = id + 1;
    s.announcements = s.announcements ?? [];
    s.announcements.push({ id, ts: now, message: msg });
    s.announcements = s.announcements.filter((a) => a.ts >= now - 24 * 60 * 60 * 1000).slice(-50);
  });
}

export async function getAnnouncements(afterId = 0, limit = 20) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      SELECT id, ts, message
      FROM announcements
      WHERE id > ${afterId}
      ORDER BY id ASC
      LIMIT ${limit}
    `) as any[];
    return rows as Array<{ id: number; ts: string | number; message: string }>;
  }

  return withStore((s) => {
    const list = (s.announcements ?? []).filter((a) => a.id > afterId);
    return list.slice(-limit);
  });
}

export async function updateBalanceAndCheckDoubled(userId: number, balance: number) {
  const b = Number(balance);
  if (!Number.isFinite(b) || b < 0) return false;
  const sql = getSql();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      SELECT balance_baseline, balance_baseline_ts
      FROM users
      WHERE id = ${userId}
    `) as any[];
    const base = Number(rows[0]?.balance_baseline ?? 0);
    const baseTs = Number(rows[0]?.balance_baseline_ts ?? 0);
    if (!baseTs || now - baseTs > windowMs || base <= 0) {
      await sql`UPDATE users SET balance_baseline = ${b}, balance_baseline_ts = ${now} WHERE id = ${userId}`;
      return false;
    }
    if (b >= base * 2) {
      await sql`UPDATE users SET balance_baseline = ${b}, balance_baseline_ts = ${now} WHERE id = ${userId}`;
      return true;
    }
    return false;
  }

  return withStore((s) => {
    const u: any = s.users.find((x) => x.id === userId);
    if (!u) return false;
    const base = Number(u.balance_baseline ?? 0);
    const baseTs = Number(u.balance_baseline_ts ?? 0);
    if (!baseTs || now - baseTs > windowMs || base <= 0) {
      u.balance_baseline = b;
      u.balance_baseline_ts = now;
      return false;
    }
    if (b >= base * 2) {
      u.balance_baseline = b;
      u.balance_baseline_ts = now;
      return true;
    }
    return false;
  });
}


export async function findUserByUsername(username: string) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`
        SELECT id, username, role_level, created_at,
               fingerprint, active_session_token, last_seen, last_signout
        FROM users WHERE username = ${username}
      `) as any[];
    return rows[0] ?? null;
  }
  return withStore((s) => s.users.find((u) => u.username === username) ?? null);
}

export async function getOrCreateUser(username: string) {
  const sql = getSql();
  const now = Date.now();
  const initialRole = username === MASTER_USERNAME ? 3 : 0;

  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO users (username, role_level, created_at)
      VALUES (${username}, ${initialRole}, ${now})
      ON CONFLICT (username) DO NOTHING
    `;

    // Force master role to 3 (even if user existed).
    if (username === MASTER_USERNAME) {
      await sql`UPDATE users SET role_level = 3 WHERE username = ${username}`;
    }

    const rows =
      (await sql`SELECT id, username, role_level, created_at FROM users WHERE username = ${username}`) as any[];
    const user = rows[0];
    if (!user) throw new Error("Failed to create user");

    await sql`
      INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at, active)
      VALUES (${user.id}, 0, 0, 0, ${now}, TRUE)
      ON CONFLICT (user_id) DO NOTHING
    `;
    return user as { id: number; username: string; role_level: number; created_at: number };
  }

  return withStore((s) => {
    const existing = s.users.find((u) => u.username === username);
    if (existing) {
      if (existing.username === MASTER_USERNAME) existing.role_level = 3;
      return existing;
    }
    const user = { id: s.nextUserId++, username, role_level: initialRole, created_at: now };
    s.users.push(user);
    // Ensure leaderboard exists
    if (!s.leaderboard.find((l) => l.user_id === user.id)) {
      s.leaderboard.push({
        user_id: user.id,
        profit_total: 0,
        wager_total: 0,
        bets: 0,
        updated_at: now,
        active: true,
      });
    }
    return user;
  });
}

export async function createSession(userId: number, token: string) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`INSERT INTO sessions (token, user_id, created_at) VALUES (${token}, ${userId}, ${now})`;
    return;
  }

  return withStore((s) => {
    s.sessions.push({ token, user_id: userId, created_at: now });
    if (s.sessions.length > 5000) s.sessions.splice(0, s.sessions.length - 5000);
  });
}

export async function getUserBySessionToken(token: string): Promise<AuthedUserWithRole | null> {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`
        SELECT u.id as id, u.username as username, u.role_level as role_level
             , u.prestige_level as prestige_level, u.name_color as name_color
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ${token}
      `) as any[];
    const user = rows[0] ?? null;
    if (user) {
      const now = Date.now();
      await sql`UPDATE users SET last_seen = ${now} WHERE id = ${user.id}`;
    }
    return user;
  }

  return withStore((s) => {
    const sess = s.sessions.find((x) => x.token === token);
    if (!sess) return null;
    const user = s.users.find((u) => u.id === sess.user_id);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      role_level: user.role_level ?? 0,
      prestige_level: Number((user as any).prestige_level ?? 0),
      name_color: ((user as any).name_color ?? null) as any,
    };
  });
}

export async function loginUsernameWithToken(input: {
  username: string;
  token: string;
  fingerprint: string;
  lockReleaseMs: number; // 24h
  inactiveCutoffMs: number; // 30d
}) {
  const { username, token, fingerprint, lockReleaseMs, inactiveCutoffMs } = input;
  const now = Date.now();
  const sql = getSql();

  if (sql) {
    await ensureSchema();

    // Mark inactive leaderboard rows (lazy maintenance)
    await ensureLeaderboardInactivityCutoff(inactiveCutoffMs);

    // Ensure user exists
    await sql`
      INSERT INTO users (username, role_level, created_at)
      VALUES (${username}, ${username === MASTER_USERNAME ? 3 : 0}, ${now})
      ON CONFLICT (username) DO NOTHING
    `;
    if (username === MASTER_USERNAME) {
      await sql`UPDATE users SET role_level = 3 WHERE username = ${username}`;
    }

    const urows =
      (await sql`
        SELECT id, username, role_level, fingerprint, active_session_token, last_signout
             , prestige_level, name_color
        FROM users WHERE username = ${username}
      `) as any[];
    const user = urows[0];
    if (!user) throw new Error("User lookup failed");

    // If username is currently active elsewhere, only allow replacing session if fingerprint matches.
    if (user.active_session_token) {
      if (user.fingerprint && user.fingerprint === fingerprint) {
        await sql`DELETE FROM sessions WHERE token = ${user.active_session_token}`;
        await sql`UPDATE users SET active_session_token = NULL WHERE id = ${user.id}`;
      } else {
        throw new Error("Username is currently in use.");
      }
    }

    // If fingerprint mismatched, only allow takeover 24h after signout.
    if (user.fingerprint && user.fingerprint !== fingerprint) {
      const lastSignout = Number(user.last_signout ?? 0);
      if (now - lastSignout < lockReleaseMs) {
        throw new Error("Username is locked to another device. Try again later.");
      }
    }

    await sql`
      UPDATE users
      SET fingerprint = ${fingerprint},
          active_session_token = ${token},
          last_seen = ${now}
      WHERE id = ${user.id}
    `;
    await sql`INSERT INTO sessions (token, user_id, created_at) VALUES (${token}, ${user.id}, ${now})`;

    // Ensure leaderboard row exists
    await sql`
      INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at, active)
      VALUES (${user.id}, 0, 0, 0, ${now}, TRUE)
      ON CONFLICT (user_id) DO NOTHING
    `;

    const lrows =
      (await sql`SELECT active, updated_at FROM leaderboard WHERE user_id = ${user.id}`) as any[];
    const l = lrows[0];
    const inactivePrompt = !!l && (l.active === false);

    return {
      user: {
        id: user.id,
        username: user.username,
        role_level: user.role_level as number,
        prestige_level: Number(user.prestige_level ?? 0),
        name_color: (user.name_color ?? null) as any,
      },
      inactivePrompt,
    };
  }

  // File-store fallback (dev only)
  await ensureLeaderboardInactivityCutoff(inactiveCutoffMs);
  const u = await getOrCreateUser(username);
  return withStore((s) => {
    const user = s.users.find((x) => x.id === u.id)!;

    const activeToken = (user as any).active_session_token as string | null | undefined;
    if (activeToken) {
      if ((user as any).fingerprint === fingerprint) {
        s.sessions = s.sessions.filter((x) => x.token !== activeToken);
        (user as any).active_session_token = null;
      } else {
        throw new Error("Username is currently in use.");
      }
    }

    const storedFp = (user as any).fingerprint as string | undefined;
    const lastSignout = Number((user as any).last_signout ?? 0);
    if (storedFp && storedFp !== fingerprint && now - lastSignout < lockReleaseMs) {
      throw new Error("Username is locked to another device. Try again later.");
    }

    (user as any).fingerprint = fingerprint;
    (user as any).active_session_token = token;
    (user as any).last_seen = now;

    s.sessions.push({ token, user_id: user.id, created_at: now });
    const l = s.leaderboard.find((x) => x.user_id === user.id) as any;
    const inactivePrompt = !!l && l.active === false;
    return {
      user: {
        id: user.id,
        username: user.username,
        role_level: user.role_level ?? 0,
        prestige_level: Number((user as any).prestige_level ?? 0),
        name_color: ((user as any).name_color ?? null) as any,
      },
      inactivePrompt,
    };
  });
}

export async function updateUserCustomizations(input: {
  userId: number;
  prestige_level?: number;
  name_color?: string | null;
}): Promise<AuthedUserWithRole | null> {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    const uid = Number(input.userId);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    if (typeof input.prestige_level === "number") {
      await sql`UPDATE users SET prestige_level = GREATEST(prestige_level, ${Math.floor(input.prestige_level)}) WHERE id = ${uid}`;
    }
    if (Object.prototype.hasOwnProperty.call(input, "name_color")) {
      await sql`UPDATE users SET name_color = ${input.name_color ?? null} WHERE id = ${uid}`;
    }
    const rows =
      (await sql`SELECT id, username, role_level, prestige_level, name_color FROM users WHERE id = ${uid}`) as any[];
    const u = rows[0] ?? null;
    if (!u) return null;
    await sql`UPDATE users SET last_seen = ${now} WHERE id = ${uid}`;
    return {
      id: Number(u.id),
      username: String(u.username),
      role_level: Number(u.role_level ?? 0),
      prestige_level: Number(u.prestige_level ?? 0),
      name_color: (u.name_color ?? null) as any,
    };
  }

  return withStore((s) => {
    const u = s.users.find((x) => x.id === input.userId);
    if (!u) return null;
    if (typeof input.prestige_level === "number") {
      (u as any).prestige_level = Math.max(Number((u as any).prestige_level ?? 0), Math.floor(input.prestige_level));
    }
    if (Object.prototype.hasOwnProperty.call(input, "name_color")) {
      (u as any).name_color = input.name_color ?? null;
    }
    return {
      id: u.id,
      username: u.username,
      role_level: u.role_level ?? 0,
      prestige_level: Number((u as any).prestige_level ?? 0),
      name_color: ((u as any).name_color ?? null) as any,
    };
  });
}

export async function signOutByToken(token: string) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      SELECT user_id FROM sessions WHERE token = ${token}
    `) as any[];
    const userId = rows[0]?.user_id as number | undefined;
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    if (userId) {
      await sql`
        UPDATE users
        SET active_session_token = NULL,
            last_signout = ${now}
        WHERE id = ${userId} AND active_session_token = ${token}
      `;
    }
    return;
  }

  return withStore((s) => {
    const sessIdx = s.sessions.findIndex((x) => x.token === token);
    const userId = sessIdx >= 0 ? s.sessions[sessIdx]!.user_id : null;
    if (sessIdx >= 0) s.sessions.splice(sessIdx, 1);
    if (userId != null) {
      const u = s.users.find((x) => x.id === userId);
      if (u && (u as any).active_session_token === token) (u as any).active_session_token = null;
      (u as any).last_signout = now;
    }
  });
}

export async function ensureLeaderboardInactivityCutoff(cutoffMs: number) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    await sql`
      UPDATE leaderboard
      SET active = FALSE
      WHERE active = TRUE AND updated_at < ${cutoffMs}
    `;
    return;
  }

  return withStore((s) => {
    for (const l of s.leaderboard) {
      if (l.updated_at < cutoffMs) (l as any).active = false;
    }
  });
}

export async function getLeaderboardRowForUser(userId: number) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      SELECT user_id, profit_total, wager_total, bets, updated_at, active
      FROM leaderboard WHERE user_id = ${userId}
    `) as any[];
    return rows[0] ?? null;
  }

  return withStore((s) => s.leaderboard.find((l) => l.user_id === userId) ?? null);
}

export async function setLeaderboardActive(userId: number, active: boolean, reset: boolean) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    if (reset) {
      await sql`
        INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at, active)
        VALUES (${userId}, 0, 0, 0, ${now}, TRUE)
        ON CONFLICT (user_id) DO UPDATE SET
          profit_total = 0,
          wager_total = 0,
          bets = 0,
          updated_at = ${now},
          active = TRUE
      `;
      return;
    }
    await sql`
      UPDATE leaderboard
      SET active = ${active}, updated_at = ${now}
      WHERE user_id = ${userId}
    `;
    return;
  }

  return withStore((s) => {
    let l = s.leaderboard.find((x) => x.user_id === userId) as any;
    if (!l) {
      l = { user_id: userId, profit_total: 0, wager_total: 0, bets: 0, updated_at: now, active: true };
      s.leaderboard.push(l);
    }
    if (reset) {
      l.profit_total = 0;
      l.wager_total = 0;
      l.bets = 0;
    }
    l.active = active;
    l.updated_at = now;
  });
}

export async function recordLeaderboard(userId: number, profit: number, wager: number) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at)
      VALUES (${userId}, ${profit}, ${wager}, 1, ${now})
      ON CONFLICT (user_id) DO UPDATE SET
        profit_total = leaderboard.profit_total + EXCLUDED.profit_total,
        wager_total = leaderboard.wager_total + EXCLUDED.wager_total,
        bets = leaderboard.bets + 1,
        updated_at = EXCLUDED.updated_at
    `;
    await sql`UPDATE users SET last_seen = ${now} WHERE id = ${userId}`;
    return;
  }

  return withStore((s) => {
    let row = s.leaderboard.find((l) => l.user_id === userId) as any;
    if (!row) {
      const created = {
        user_id: userId,
        profit_total: 0,
        wager_total: 0,
        bets: 0,
        updated_at: now,
        active: true,
      } as any;
      s.leaderboard.push(created);
      row = created;
    }
    row.profit_total = Number(row.profit_total) + profit;
    row.wager_total = Number(row.wager_total) + wager;
    row.bets = Number(row.bets) + 1;
    row.updated_at = now;
    const u: any = s.users.find((x) => x.id === userId);
    if (u) u.last_seen = now;
  });
}

export async function getTotalWagered() {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`SELECT COALESCE(SUM(wager_total), 0) AS total FROM leaderboard`) as any[];
    return Number(rows[0]?.total ?? 0);
  }
  return withStore((s) => s.leaderboard.reduce((a, b) => a + Number(b.wager_total ?? 0), 0));
}

export async function recordGameStat(gameId: string, wager: number) {
  const gid = String(gameId ?? "").slice(0, 48);
  const w = Number(wager ?? 0);
  if (!gid || !Number.isFinite(w) || w < 0) return;
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO game_stats (game_id, wager_total, bets, updated_at)
      VALUES (${gid}, ${w}, 1, ${now})
      ON CONFLICT (game_id) DO UPDATE SET
        wager_total = game_stats.wager_total + EXCLUDED.wager_total,
        bets = game_stats.bets + 1,
        updated_at = EXCLUDED.updated_at
    `;
    return;
  }

  return withStore((s) => {
    s.game_stats = s.game_stats ?? [];
    let row = s.game_stats.find((g) => g.game_id === gid);
    if (!row) {
      row = { game_id: gid, wager_total: 0, bets: 0, updated_at: now };
      s.game_stats.push(row);
    }
    row.wager_total = Number(row.wager_total) + w;
    row.bets = Number(row.bets) + 1;
    row.updated_at = now;
  });
}

export async function getGameStats() {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`
        SELECT game_id, wager_total, bets, updated_at
        FROM game_stats
      `) as any[];
    return rows as Array<{ game_id: string; wager_total: number; bets: number; updated_at: number }>;
  }
  return withStore((s) => (s.game_stats ?? []).slice());
}

export async function upsertBlackjackInventory(userId: number, inventory: any) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return;
  const now = Date.now();
  const sql = getSql();
  const invJson = JSON.stringify(inventory ?? {});
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO blackjack_inventories (user_id, inventory_json, updated_at)
      VALUES (${uid}, ${invJson}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET
        inventory_json = EXCLUDED.inventory_json,
        updated_at = EXCLUDED.updated_at
    `;
    return;
  }
  return withStore((s) => {
    s.blackjack_inventories = s.blackjack_inventories ?? [];
    let row = s.blackjack_inventories.find((r) => r.user_id === uid);
    if (!row) {
      row = { user_id: uid, inventory: {}, updated_at: now };
      s.blackjack_inventories.push(row);
    }
    row.inventory = inventory ?? {};
    row.updated_at = now;
  });
}

export async function getBlackjackInventory(userId: number) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`SELECT inventory_json FROM blackjack_inventories WHERE user_id = ${uid}`) as any[];
    const raw = rows[0]?.inventory_json;
    if (!raw) return null;
    try {
      return JSON.parse(String(raw));
    } catch {
      return null;
    }
  }
  return withStore((s) => {
    const row = (s.blackjack_inventories ?? []).find((r) => r.user_id === uid);
    return row?.inventory ?? null;
  });
}

export async function upsertBlackjackTable(input: {
  id: string;
  public: boolean;
  name: string;
  state: any;
  created_at: number;
  updated_at: number;
}) {
  const id = String(input.id ?? "").slice(0, 48);
  if (!id) return;
  const now = Number(input.updated_at ?? Date.now());
  const created = Number(input.created_at ?? now);
  const name = String(input.name ?? "Table").slice(0, 48);
  const pub = !!input.public;
  const stateJson = JSON.stringify(input.state ?? {});

  const sql = getSql();
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO blackjack_tables (id, public, name, state_json, created_at, updated_at)
      VALUES (${id}, ${pub}, ${name}, ${stateJson}, ${created}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        public = EXCLUDED.public,
        name = EXCLUDED.name,
        state_json = EXCLUDED.state_json,
        updated_at = EXCLUDED.updated_at
    `;
    return;
  }
  return withStore((s) => {
    s.blackjack_tables = s.blackjack_tables ?? [];
    let row = s.blackjack_tables.find((t) => t.id === id);
    if (!row) {
      row = { id, public: pub, name, state: input.state ?? {}, created_at: created, updated_at: now };
      s.blackjack_tables.push(row);
    }
    row.public = pub;
    row.name = name;
    row.state = input.state ?? {};
    row.updated_at = now;
    row.created_at = row.created_at || created;
  });
}

export async function getBlackjackTable(id: string) {
  const tid = String(id ?? "").slice(0, 48);
  if (!tid) return null;
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`SELECT id, public, name, state_json, created_at, updated_at FROM blackjack_tables WHERE id = ${tid}`) as any[];
    const r = rows[0];
    if (!r) return null;
    let state: any = {};
    try {
      state = JSON.parse(String(r.state_json ?? "{}"));
    } catch {
      state = {};
    }
    return {
      id: String(r.id),
      public: !!r.public,
      name: String(r.name),
      state,
      created_at: Number(r.created_at ?? Date.now()),
      updated_at: Number(r.updated_at ?? Date.now()),
    };
  }
  return withStore((s) => (s.blackjack_tables ?? []).find((t) => t.id === tid) ?? null);
}

export async function listBlackjackTables() {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`SELECT id, public, name, created_at, updated_at FROM blackjack_tables ORDER BY updated_at DESC LIMIT 50`) as any[];
    return rows.map((r) => ({
      id: String(r.id),
      public: !!r.public,
      name: String(r.name),
      created_at: Number(r.created_at ?? 0),
      updated_at: Number(r.updated_at ?? 0),
    }));
  }
  return withStore((s) =>
    (s.blackjack_tables ?? [])
      .slice()
      .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
      .slice(0, 50)
      .map((t) => ({
        id: t.id,
        public: !!t.public,
        name: t.name,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
  );
}

export async function getLeaderboardRows(limit = 50) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    await ensureLeaderboardInactivityCutoff(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows =
      (await sql`
        SELECT u.username as username,
               l.profit_total as profit_total,
               l.wager_total as wager_total,
               l.bets as bets,
               l.updated_at as updated_at
        FROM leaderboard l
        JOIN users u ON u.id = l.user_id
        WHERE u.role_level = 0 AND l.active = TRUE
        ORDER BY l.profit_total DESC
        LIMIT ${limit}
      `) as any[];
    return rows;
  }

  return withStore((s) => {
    const byId = new Map(s.users.map((u) => [u.id, u]));
    return s.leaderboard
      .map((l) => {
        const u = byId.get(l.user_id);
        return {
          username: u?.username ?? "unknown",
          role_level: u?.role_level ?? 0,
          active: (l as any).active !== false,
          profit_total: l.profit_total,
          wager_total: l.wager_total,
          bets: l.bets,
          updated_at: l.updated_at,
        };
      })
      .filter((r) => (r.role_level ?? 0) === 0 && r.active)
      .sort((a, b) => b.profit_total - a.profit_total)
      .slice(0, limit)
      .map(({ role_level: _rl, active: _a, ...rest }) => rest);
  });
}

export async function setUserRoleByUsername(targetUsername: string, roleLevel: number) {
  const lvl = Math.max(0, Math.min(3, Math.floor(roleLevel)));
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE users SET role_level = ${lvl} WHERE username = ${targetUsername}`;
    // Ensure leaderboard row exists (even for admins)
    const rows = (await sql`SELECT id FROM users WHERE username = ${targetUsername}`) as any[];
    const id = rows[0]?.id;
    if (id) {
      await sql`
        INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at, active)
        VALUES (${id}, 0, 0, 0, ${now}, TRUE)
        ON CONFLICT (user_id) DO NOTHING
      `;
    }
    return;
  }

  return withStore((s) => {
    const u = s.users.find((x) => x.username === targetUsername);
    if (!u) return;
    u.role_level = lvl;
  });
}

export async function resetLeaderboard() {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    await sql`
      UPDATE leaderboard l
      SET profit_total = 0, wager_total = 0, bets = 0, updated_at = ${now}
      FROM users u
      WHERE u.id = l.user_id AND u.role_level = 0
    `;
    return;
  }

  return withStore((s) => {
    for (const l of s.leaderboard) {
      const u = s.users.find((x) => x.id === l.user_id);
      if (u && (u.role_level ?? 0) === 0) {
        l.profit_total = 0;
        l.wager_total = 0;
        l.bets = 0;
        l.updated_at = now;
      }
    }
  });
}

export async function wipeUserStats(username: string) {
  const sql = getSql();
  const now = Date.now();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`SELECT id FROM users WHERE username = ${username}`) as any[];
    const id = rows[0]?.id;
    if (!id) return;
    await sql`
      INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at)
      VALUES (${id}, 0, 0, 0, ${now})
      ON CONFLICT (user_id) DO UPDATE SET
        profit_total = 0, wager_total = 0, bets = 0, updated_at = ${now}
    `;
    return;
  }

  return withStore((s) => {
    const u = s.users.find((x) => x.username === username);
    if (!u) return;
    let l = s.leaderboard.find((x) => x.user_id === u.id);
    if (!l) {
      l = { user_id: u.id, profit_total: 0, wager_total: 0, bets: 0, updated_at: now };
      s.leaderboard.push(l);
    }
    l.profit_total = 0;
    l.wager_total = 0;
    l.bets = 0;
    l.updated_at = now;
  });
}

export type GameConfig = {
  diceHouseEdge: number; // 0.01 = 1%
  slotsPayoutScale: number; // 1.0 default
};

export const DEFAULT_CONFIG: GameConfig = {
  diceHouseEdge: 0.01,
  slotsPayoutScale: 1.0,
};

export async function getConfig(): Promise<GameConfig> {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows = (await sql`SELECT key, value FROM config`) as any[];
    const map = new Map<string, string>(rows.map((r: any) => [r.key, r.value]));
    return {
      diceHouseEdge: Number(map.get("diceHouseEdge") ?? DEFAULT_CONFIG.diceHouseEdge),
      slotsPayoutScale: Number(map.get("slotsPayoutScale") ?? DEFAULT_CONFIG.slotsPayoutScale),
    };
  }

  return withStore((s) => {
    const diceHouseEdge = Number(s.config?.diceHouseEdge?.value ?? DEFAULT_CONFIG.diceHouseEdge);
    const slotsPayoutScale = Number(s.config?.slotsPayoutScale?.value ?? DEFAULT_CONFIG.slotsPayoutScale);
    return { diceHouseEdge, slotsPayoutScale };
  });
}

export async function setConfig(partial: Partial<GameConfig>) {
  const sql = getSql();
  const now = Date.now();
  const next: GameConfig = {
    ...(await getConfig()),
    ...partial,
  };
  // basic sanity bounds
  next.diceHouseEdge = Math.min(0.1, Math.max(0, next.diceHouseEdge));
  next.slotsPayoutScale = Math.min(10, Math.max(0.1, next.slotsPayoutScale));

  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO config (key, value, updated_at)
      VALUES
        ('diceHouseEdge', ${String(next.diceHouseEdge)}, ${now}),
        ('slotsPayoutScale', ${String(next.slotsPayoutScale)}, ${now})
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `;
    return next;
  }

  return withStore((s) => {
    s.config = s.config ?? {};
    s.config.diceHouseEdge = { value: String(next.diceHouseEdge), updated_at: now };
    s.config.slotsPayoutScale = { value: String(next.slotsPayoutScale), updated_at: now };
    return next;
  });
}
