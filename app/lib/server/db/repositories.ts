import "server-only";
import {
  getSql,
  useDatabase,
  withStore,
  type JsonStore,
  type PersistedWalletState,
  normalizeUsername,
  masterUsername,
} from "./client";
import { ensureSchema } from "./migrate";
import { RoleLevel } from "../../shared/constants";

export type AuthedUser = { id: number; username: string };
export type AuthedUserWithRole = {
  id: number;
  username: string;
  role_level: number;
  prestige_level?: number;
  prestige_points?: number;
  name_color?: string | null;
  discord_avatar_url?: string | null;
};

export type UserRow = {
  id: number;
  username: string;
  role_level: number;
  created_at: number;
  last_seen?: number;
  fingerprint?: string | null;
  fingerprint_locked_at?: number | null;
  active_session_token?: string | null;
  banned?: boolean;
  customizations?: unknown;
};

async function ready() {
  if (useDatabase) await ensureSchema();
}

function mapUser(r: Record<string, unknown>): UserRow {
  return {
    id: Number(r.id),
    username: String(r.username),
    role_level: Number(r.role_level ?? 0),
    created_at: Number(r.created_at ?? Date.now()),
    last_seen: r.last_seen != null ? Number(r.last_seen) : undefined,
    fingerprint: (r.fingerprint as string | null | undefined) ?? null,
    fingerprint_locked_at:
      r.fingerprint_locked_at != null ? Number(r.fingerprint_locked_at) : null,
    active_session_token: (r.active_session_token as string | null | undefined) ?? null,
    banned: Boolean(r.banned ?? false),
    customizations: r.customizations,
  };
}

export const usersRepo = {
  async ensure(usernameRaw: string, opts: { roleLevel?: number } = {}): Promise<AuthedUserWithRole> {
    await ready();
    const username = normalizeUsername(usernameRaw);
    const roleLevel = opts.roleLevel ?? (username === masterUsername() ? RoleLevel.MASTER : RoleLevel.USER);
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`
        INSERT INTO users (username, role_level, created_at)
        VALUES (${username}, ${roleLevel}, ${Date.now()})
        ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
        RETURNING id, username, role_level
      ` as unknown as { id: number; username: string; role_level: number }[];
      const r = rows[0]!;
      return { id: r.id, username: r.username, role_level: r.role_level };
    }
    return withStore(async (s) => {
      let u = s.users.find((x) => normalizeUsername(String(x.username)) === username) as UserRow | undefined;
      if (!u) {
        u = mapUser({
          id: s.nextUserId++,
          username,
          role_level: roleLevel,
          created_at: Date.now(),
        });
        s.users.push(u as unknown as Record<string, unknown>);
      }
      return { id: u.id, username: u.username, role_level: u.role_level };
    });
  },

  async getById(id: number): Promise<AuthedUserWithRole | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT id, username, role_level FROM users WHERE id = ${id}` as unknown as AuthedUserWithRole[];
      const r = rows[0];
      return r ?? null;
    }
    return withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      return u ? { id: u.id, username: u.username, role_level: u.role_level } : null;
    });
  },

  async getFullById(id: number): Promise<UserRow | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM users WHERE id = ${id}` as unknown as Record<string, unknown>[];
      const r = rows[0];
      return r ? mapUser(r) : null;
    }
    return withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      return u ?? null;
    });
  },

  async getByUsername(usernameRaw: string): Promise<UserRow | null> {
    await ready();
    const username = normalizeUsername(usernameRaw);
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM users WHERE username = ${username}` as unknown as Record<string, unknown>[];
      const r = rows[0];
      return r ? mapUser(r) : null;
    }
    return withStore((s) => {
      const u = s.users.find((x) => normalizeUsername(String(x.username)) === username) as UserRow | undefined;
      return u ?? null;
    });
  },

  async setRole(id: number, roleLevel: number): Promise<void> {
    await ready();
    const target = await this.getById(id);
    if (target && normalizeUsername(target.username) === masterUsername()) return;
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE users SET role_level = ${roleLevel} WHERE id = ${id} AND username <> ${masterUsername()}`;
      return;
    }
    await withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      if (u && normalizeUsername(u.username) !== masterUsername()) u.role_level = roleLevel;
    });
  },

  async touchLastSeen(id: number, token: string | null): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE users SET last_seen = ${Date.now()}, active_session_token = ${token} WHERE id = ${id}`;
      return;
    }
    await withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      if (u) {
        u.last_seen = Date.now();
        u.active_session_token = token;
      }
    });
  },

  async setFingerprint(id: number, fingerprint: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE users SET fingerprint = ${fingerprint}, fingerprint_locked_at = ${Date.now()} WHERE id = ${id}`;
      return;
    }
    await withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      if (u) {
        u.fingerprint = fingerprint;
        u.fingerprint_locked_at = Date.now();
      }
    });
  },

  async releaseFingerprintLock(id: number): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE users SET fingerprint_locked_at = ${0} WHERE id = ${id}`;
      return;
    }
    await withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      if (u) u.fingerprint_locked_at = 0;
    });
  },

  async setBanned(id: number, banned: boolean): Promise<void> {
    await ready();
    const target = await this.getById(id);
    if (!target || normalizeUsername(target.username) === masterUsername()) return;
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE users SET banned = ${banned} WHERE id = ${id} AND username <> ${masterUsername()}`;
      return;
    }
    await withStore((s) => {
      const u = s.users.find((x) => Number(x.id) === id) as UserRow | undefined;
      if (u && normalizeUsername(u.username) !== masterUsername()) u.banned = banned;
    });
  },

  async listForAdmin(): Promise<UserRow[]> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = (await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 500`) as Record<string, unknown>[];
      return rows.map(mapUser);
    }
    return withStore((s) => (s.users as UserRow[]).map(mapUser));
  },

  async wipe(id: number): Promise<void> {
    await ready();
    const target = await this.getById(id);
    if (!target || normalizeUsername(target.username) === masterUsername()) return;
    if (useDatabase) {
      const sql = getSql()!;
      await sql`DELETE FROM users WHERE id = ${id} AND username <> ${masterUsername()}`;
      await sql`DELETE FROM sessions WHERE user_id = ${id}`;
      await sql`DELETE FROM user_wallets WHERE user_id = ${id}`;
      await sql`DELETE FROM blackjack_inventories WHERE user_id = ${id}`;
      await sql`DELETE FROM leaderboard WHERE user_id = ${id}`;
      return;
    }
    await withStore((s) => {
      s.users = s.users.filter((x) => Number(x.id) !== id);
      s.sessions = s.sessions.filter((x) => x.user_id !== id);
      s.user_wallets = (s.user_wallets ?? []).filter((x) => Number(x.user_id) !== id);
      s.blackjack_inventories = (s.blackjack_inventories ?? []).filter((x) => Number(x.user_id) !== id);
      s.leaderboard = s.leaderboard.filter((x) => Number(x.user_id) !== id);
    });
  },
};

export const sessionsRepo = {
  async create(userId: number, token: string, method: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`INSERT INTO sessions (token, user_id, created_at, method) VALUES (${token}, ${userId}, ${Date.now()}, ${method})
        ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`;
      return;
    }
    await withStore((s) => {
      s.sessions.push({ token, user_id: userId, created_at: Date.now(), method });
    });
  },

  async getByToken(token: string): Promise<{ token: string; user_id: number; created_at: number; method?: string } | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM sessions WHERE token = ${token}` as unknown as { token: string; user_id: number; created_at: number; method?: string }[];
      return rows[0] ?? null;
    }
    return withStore((s) => s.sessions.find((x) => x.token === token) ?? null);
  },

  async delete(token: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      return;
    }
    await withStore((s) => {
      s.sessions = s.sessions.filter((x) => x.token !== token);
    });
  },

  async touch(token: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`UPDATE sessions SET created_at = ${Date.now()} WHERE token = ${token}`;
      return;
    }
    await withStore((s) => {
      const row = s.sessions.find((x) => x.token === token);
      if (row) row.created_at = Date.now();
    });
  },
};

export const walletsRepo = {
  async getState(userId: number): Promise<PersistedWalletState | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT state FROM user_wallets WHERE user_id = ${userId}` as unknown as { state?: PersistedWalletState }[];
      const r = rows[0];
      return (r?.state as PersistedWalletState | undefined) ?? null;
    }
    return withStore((s) => {
      const w = (s.user_wallets ?? []).find((x) => Number(x.user_id) === userId) as
        | { state: PersistedWalletState }
        | undefined;
      return w?.state ?? null;
    });
  },

  async saveState(userId: number, state: PersistedWalletState): Promise<void> {
    await ready();
    state.updatedAt = Date.now();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO user_wallets (user_id, state, updated_at) VALUES (${userId}, ${JSON.stringify(state)}, ${Date.now()})
        ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
      `;
      return;
    }
    await withStore((s) => {
      s.user_wallets = s.user_wallets ?? [];
      const idx = s.user_wallets.findIndex((x) => Number(x.user_id) === userId);
      const row = { user_id: userId, state, updated_at: Date.now() };
      if (idx >= 0) s.user_wallets[idx] = row;
      else s.user_wallets.push(row);
    });
  },
};

export const configRepo = {
  async get<T = string>(key: string, fallback: T): Promise<T> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT value FROM config WHERE key = ${key}` as unknown as { value?: string }[];
      const r = rows[0];
      return r?.value ? (r.value as unknown as T) : fallback;
    }
    return withStore((s) => {
      const c = s.config[key];
      return c ? (c.value as unknown as T) : fallback;
    });
  },

  async set(key: string, value: string): Promise<void> {
    await ready();
    const now = Date.now();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO config (key, value, updated_at) VALUES (${key}, ${value}, ${now})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `;
      return;
    }
    await withStore((s) => {
      s.config[key] = { value, updated_at: now };
    });
  },

  async getAll(): Promise<Record<string, string>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = (await sql`SELECT key, value FROM config`) as { key: string; value: string }[];
      const out: Record<string, string> = {};
      for (const r of rows) out[r.key] = r.value;
      return out;
    }
    return withStore((s) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.config)) out[k] = v.value;
      return out;
    });
  },
};

export const leaderboardRepo = {
  async record(userId: number, profit: number, wager: number): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO leaderboard (user_id, profit_total, wager_total, bets, updated_at)
        VALUES (${userId}, ${profit}, ${wager}, 1, ${Date.now()})
        ON CONFLICT (user_id) DO UPDATE SET
          profit_total = leaderboard.profit_total + EXCLUDED.profit_total,
          wager_total = leaderboard.wager_total + EXCLUDED.wager_total,
          bets = leaderboard.bets + 1,
          updated_at = EXCLUDED.updated_at
      `;
      return;
    }
    await withStore((s) => {
      let row = s.leaderboard.find((x) => Number(x.user_id) === userId);
      if (!row) {
        row = { user_id: userId, profit_total: 0, wager_total: 0, bets: 0, updated_at: Date.now() };
        s.leaderboard.push(row);
      }
      row.profit_total = Number(row.profit_total) + profit;
      row.wager_total = Number(row.wager_total) + wager;
      row.bets = Number(row.bets) + 1;
      row.updated_at = Date.now();
    });
  },

  async top(limit = 50): Promise<Array<{ user_id: number; profit_total: number; wager_total: number; bets: number }>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`
        SELECT user_id, profit_total, wager_total, bets FROM leaderboard
        ORDER BY profit_total DESC LIMIT ${limit}
      `;
      return rows as Array<{ user_id: number; profit_total: number; wager_total: number; bets: number }>;
    }
    return withStore((s) =>
      s.leaderboard
        .map((x) => ({
          user_id: Number(x.user_id),
          profit_total: Number(x.profit_total),
          wager_total: Number(x.wager_total),
          bets: Number(x.bets),
        }))
        .sort((a, b) => b.profit_total - a.profit_total)
        .slice(0, limit)
    );
  },

  async reset(): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`DELETE FROM leaderboard`;
      return;
    }
    await withStore((s) => {
      s.leaderboard = [];
    });
  },
};

export type { JsonStore };
