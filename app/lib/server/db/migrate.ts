import "server-only";
import { getSql, withStore, useDatabase, type SqlClient } from "./client";

export const CURRENT_SCHEMA_VERSION = 3;

type Migration = {
  version: number;
  description: string;
  sql: (sql: SqlClient) => Promise<unknown>;
  json: (s: {
    store: import("./client").JsonStore;
  }) => void;
};

const BASE_TABLES_SQL: Array<(_: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>> = [];

const migrations: Migration[] = [
  {
    version: 1,
    description: "core tables (users, sessions, leaderboard, config, chat, announcements)",
    sql: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          role_level INT NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id),
          created_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS leaderboard (
          user_id INT PRIMARY KEY REFERENCES users(id),
          profit_total DOUBLE PRECISION NOT NULL DEFAULT 0,
          wager_total DOUBLE PRECISION NOT NULL DEFAULT 0,
          bets INT NOT NULL DEFAULT 0,
          updated_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          ts BIGINT NOT NULL,
          message TEXT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS global_chat (
          id SERIAL PRIMARY KEY,
          ts BIGINT NOT NULL,
          user_id INT NOT NULL REFERENCES users(id),
          username TEXT NOT NULL,
          text TEXT NOT NULL
        )`;
    },
    json: ({ store }) => {
      void store;
    },
  },
  {
    version: 2,
    description: "discord linking, mobile auth, progress reset, game stats",
    sql: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS discord_links (
          discord_id TEXT PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id),
          created_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS discord_mobile_auths (
          token TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          channel_id TEXT,
          user_id INT,
          session_token TEXT,
          created_at BIGINT NOT NULL,
          expires_at BIGINT NOT NULL,
          completed_at BIGINT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS progress_reset_requests (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id),
          username TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at BIGINT NOT NULL,
          reviewed_at BIGINT,
          reviewed_by_user_id INT,
          reviewed_by_username TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS game_stats (
          game_id TEXT PRIMARY KEY,
          wager_total DOUBLE PRECISION NOT NULL DEFAULT 0,
          bets INT NOT NULL DEFAULT 0,
          updated_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS game_stat_events (
          id SERIAL PRIMARY KEY,
          ts BIGINT NOT NULL,
          game_id TEXT NOT NULL,
          wager DOUBLE PRECISION NOT NULL
        )`;
    },
    json: ({ store }) => {
      void store;
    },
  },
  {
    version: 3,
    description: "blackjack tables + inventories, wallets",
    sql: async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS blackjack_tables (
          id TEXT PRIMARY KEY,
          public BOOLEAN NOT NULL DEFAULT TRUE,
          name TEXT NOT NULL,
          state JSONB NOT NULL,
          updated_at BIGINT NOT NULL,
          created_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS blackjack_inventories (
          user_id INT PRIMARY KEY REFERENCES users(id),
          inventory JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS user_wallets (
          user_id INT PRIMARY KEY REFERENCES users(id),
          state JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        )`;
    },
    json: ({ store }) => {
      void store;
    },
  },
];

void BASE_TABLES_SQL;

async function getSchemaVersion(): Promise<number> {
  if (useDatabase) {
    const sql = getSql();
    if (!sql) return 0;
    const rows = await sql`SELECT value FROM config WHERE key = ${"schema_version"}` as unknown as { value?: string }[];
    const row = rows[0];
    return row?.value ? Number(row.value) : 0;
  }
  const { readStore } = await import("./client");
  return readStore((s) => {
    const v = s.config["schema_version"];
    return v ? Number(v.value) : 0;
  });
}

async function setSchemaVersion(version: number): Promise<void> {
  if (useDatabase) {
    const sql = getSql();
    if (!sql) return;
    await sql`
      INSERT INTO config (key, value, updated_at) VALUES (${"schema_version"}, ${String(version)}, ${Date.now()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `;
    return;
  }
  const { withStore: ws } = await import("./client");
  await ws((s) => {
    s.config["schema_version"] = { value: String(version), updated_at: Date.now() };
  });
}

let booted = false;

export async function ensureSchema(): Promise<void> {
  if (booted) return;
  if (!useDatabase) {
    booted = true;
    return;
  }
  const sql = getSql();
  if (!sql) {
    booted = true;
    return;
  }
  let current = await getSchemaVersion();
  for (const m of migrations) {
    if (m.version <= current) continue;
    await m.sql(sql);
    await withStore((s) => {
      m.json({ store: s });
    });
    current = m.version;
  }
  if (current < CURRENT_SCHEMA_VERSION) {
    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
  }
  booted = true;
}

export async function runJsonMigrations(): Promise<void> {
  let current = await getSchemaVersion();
  if (current >= CURRENT_SCHEMA_VERSION) return;
  await withStore((s) => {
    for (const m of migrations) {
      if (m.version <= current) continue;
      m.json({ store: s });
      current = m.version;
    }
  });
  await setSchemaVersion(CURRENT_SCHEMA_VERSION);
}
