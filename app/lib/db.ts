import fs from "fs";
import path from "path";
import "server-only";
import { neon } from "@neondatabase/serverless";

export type AuthedUser = { id: number; username: string };
export type AuthedUserWithRole = { id: number; username: string; role_level: number };

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

type Store = {
  nextUserId: number;
  users: Array<{ id: number; username: string; role_level: number; created_at: number }>;
  sessions: Array<{ token: string; user_id: number; created_at: number }>;
  leaderboard: Array<{
    user_id: number;
    profit_total: number;
    wager_total: number;
    bets: number;
    updated_at: number;
  }>;
  config: Record<string, { value: string; updated_at: number }>;
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
  return { nextUserId: 1, users: [], sessions: [], leaderboard: [], config: {} };
}

function loadStore(): Store {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return defaultStore();
  }
}

function saveStore(store: Store) {
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
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
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
  schemaReady = true;
}

export async function findUserByUsername(username: string) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`SELECT id, username, role_level, created_at FROM users WHERE username = ${username}`) as any[];
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
      INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at)
      VALUES (${user.id}, 0, 0, 0, ${now})
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
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ${token}
      `) as any[];
    return rows[0] ?? null;
  }

  return withStore((s) => {
    const sess = s.sessions.find((x) => x.token === token);
    if (!sess) return null;
    const user = s.users.find((u) => u.id === sess.user_id);
    if (!user) return null;
    return { id: user.id, username: user.username, role_level: user.role_level ?? 0 };
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
    return;
  }

  return withStore((s) => {
    let row = s.leaderboard.find((l) => l.user_id === userId);
    if (!row) {
      row = { user_id: userId, profit_total: 0, wager_total: 0, bets: 0, updated_at: now };
      s.leaderboard.push(row);
    }
    row.profit_total = Number(row.profit_total) + profit;
    row.wager_total = Number(row.wager_total) + wager;
    row.bets = Number(row.bets) + 1;
    row.updated_at = now;
  });
}

export async function getLeaderboardRows(limit = 50) {
  const sql = getSql();
  if (sql) {
    await ensureSchema();
    const rows =
      (await sql`
        SELECT u.username as username,
               l.profit_total as profit_total,
               l.wager_total as wager_total,
               l.bets as bets,
               l.updated_at as updated_at
        FROM leaderboard l
        JOIN users u ON u.id = l.user_id
        WHERE u.role_level = 0
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
          profit_total: l.profit_total,
          wager_total: l.wager_total,
          bets: l.bets,
          updated_at: l.updated_at,
        };
      })
      .filter((r) => (r.role_level ?? 0) === 0)
      .sort((a, b) => b.profit_total - a.profit_total)
      .slice(0, limit)
      .map(({ role_level: _rl, ...rest }) => rest);
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
        INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at)
        VALUES (${id}, 0, 0, 0, ${now})
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
