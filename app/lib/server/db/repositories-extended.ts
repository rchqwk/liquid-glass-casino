import "server-only";
import { getSql, useDatabase, withStore } from "./client";
import { ensureSchema } from "./migrate";

async function ready() {
  if (useDatabase) await ensureSchema();
}

export const discordRepo = {
  async link(discordId: string, userId: number): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO discord_links (discord_id, user_id, created_at) VALUES (${discordId}, ${userId}, ${Date.now()})
        ON CONFLICT (discord_id) DO UPDATE SET user_id = EXCLUDED.user_id
      `;
      return;
    }
    await withStore((s) => {
      s.discord_links = s.discord_links ?? [];
      const idx = s.discord_links.findIndex((x) => String(x.discord_id) === discordId);
      const row = { discord_id: discordId, user_id: userId, created_at: Date.now() };
      if (idx >= 0) s.discord_links[idx] = row;
      else s.discord_links.push(row);
    });
  },

  async getUserId(discordId: string): Promise<number | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT user_id FROM discord_links WHERE discord_id = ${discordId}` as unknown as { user_id?: number }[];
      const r = rows[0];
      return r?.user_id ?? null;
    }
    return withStore((s) => {
      const row = (s.discord_links ?? []).find((x) => String(x.discord_id) === discordId);
      return row ? Number(row.user_id) : null;
    });
  },

  async createMobileAuth(entry: {
    token: string;
    code: string;
    channelId: string | null;
    createdAt: number;
    expiresAt: number;
  }): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO discord_mobile_auths (token, code, channel_id, user_id, session_token, created_at, expires_at)
        VALUES (${entry.token}, ${entry.code}, ${entry.channelId}, NULL, NULL, ${entry.createdAt}, ${entry.expiresAt})
      `;
      return;
    }
    await withStore((s) => {
      s.discord_mobile_auths = s.discord_mobile_auths ?? [];
      s.discord_mobile_auths.push({ ...entry, completed_at: null });
    });
  },

  async getMobileAuthByCode(code: string): Promise<Record<string, unknown> | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM discord_mobile_auths WHERE code = ${code} AND completed_at IS NULL` as unknown as Record<string, unknown>[];
      return rows[0] ?? null;
    }
    return withStore((s) => {
      const row = (s.discord_mobile_auths ?? []).find((x) => String(x.code) === code && !x.completed_at);
      return (row as Record<string, unknown>) ?? null;
    });
  },

  async completeMobileAuth(token: string, userId: number, sessionToken: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        UPDATE discord_mobile_auths SET user_id = ${userId}, session_token = ${sessionToken}, completed_at = ${Date.now()}
        WHERE token = ${token}
      `;
      return;
    }
    await withStore((s) => {
      const row = (s.discord_mobile_auths ?? []).find((x) => String(x.token) === token);
      if (row) {
        row.user_id = userId;
        row.session_token = sessionToken;
        row.completed_at = Date.now();
      }
    });
  },
};

export const moderationRepo = {
  async createResetRequest(userId: number, username: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO progress_reset_requests (user_id, username, status, created_at)
        VALUES (${userId}, ${username}, 'pending', ${Date.now()})
      `;
      return;
    }
    await withStore((s) => {
      s.progress_reset_requests = s.progress_reset_requests ?? [];
      const lastEntry = s.progress_reset_requests.length > 0 
        ? s.progress_reset_requests[s.progress_reset_requests.length - 1] 
        : undefined;
      const lastId = lastEntry != null ? Number(lastEntry.id ?? 0) : 0;
      s.progress_reset_requests.push({
        id: lastId + 1,
        user_id: userId,
        username,
        status: "pending",
        created_at: Date.now(),
      });
    });
  },

  async listResetRequests(): Promise<Array<Record<string, unknown>>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM progress_reset_requests WHERE status = 'pending' ORDER BY created_at DESC`;
      return rows as Array<Record<string, unknown>>;
    }
    return withStore((s) =>
      (s.progress_reset_requests ?? [])
        .filter((x) => x.status === "pending")
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
    );
  },

  async approveResetRequest(id: number, reviewerId: number, reviewerUsername: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        UPDATE progress_reset_requests SET status = 'approved', reviewed_at = ${Date.now()},
        reviewed_by_user_id = ${reviewerId}, reviewed_by_username = ${reviewerUsername}
        WHERE id = ${id}
      `;
      return;
    }
    await withStore((s) => {
      const row = (s.progress_reset_requests ?? []).find((x) => Number(x.id) === id);
      if (row) {
        row.status = "approved";
        row.reviewed_at = Date.now();
        row.reviewed_by_user_id = reviewerId;
        row.reviewed_by_username = reviewerUsername;
      }
    });
  },
};

export const socialRepo = {
  async postAnnouncement(message: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`INSERT INTO announcements (ts, message) VALUES (${Date.now()}, ${message})`;
      return;
    }
    await withStore((s) => {
      s.announcements = s.announcements ?? [];
      s.nextAnnouncementId = (s.nextAnnouncementId ?? 1) + 1;
      s.announcements.push({ id: s.nextAnnouncementId - 1, ts: Date.now(), message });
    });
  },

  async listAnnouncements(limit = 10): Promise<Array<{ id: number; ts: number; message: string }>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT id, ts, message FROM announcements ORDER BY ts DESC LIMIT ${limit}`;
      return rows as Array<{ id: number; ts: number; message: string }>;
    }
    return withStore((s) =>
      (s.announcements ?? [])
        .map((x) => ({ id: Number(x.id), ts: Number(x.ts), message: String(x.message) }))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit)
    );
  },

  async postChat(userId: number, username: string, text: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`INSERT INTO global_chat (ts, user_id, username, text) VALUES (${Date.now()}, ${userId}, ${username}, ${text})`;
      return;
    }
    await withStore((s) => {
      s.global_chat = s.global_chat ?? [];
      s.nextGlobalChatId = (s.nextGlobalChatId ?? 1) + 1;
      s.global_chat.push({ id: s.nextGlobalChatId - 1, ts: Date.now(), user_id: userId, username, text });
    });
  },

  async listChat(limit = 50): Promise<Array<{ id: number; ts: number; username: string; text: string }>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT id, ts, username, text FROM global_chat ORDER BY ts DESC LIMIT ${limit}`;
      return (rows as Array<{ id: number; ts: number; username: string; text: string }>).reverse();
    }
    return withStore((s) =>
      (s.global_chat ?? [])
        .map((x) => ({ id: Number(x.id), ts: Number(x.ts), username: String(x.username), text: String(x.text) }))
        .sort((a, b) => a.ts - b.ts)
        .slice(-limit)
    );
  },
};

export const gameStatsRepo = {
  async record(gameId: string, wager: number): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO game_stats (game_id, wager_total, bets, updated_at) VALUES (${gameId}, ${wager}, 1, ${Date.now()})
        ON CONFLICT (game_id) DO UPDATE SET
          wager_total = game_stats.wager_total + EXCLUDED.wager_total,
          bets = game_stats.bets + 1,
          updated_at = EXCLUDED.updated_at
      `;
      await sql`INSERT INTO game_stat_events (ts, game_id, wager) VALUES (${Date.now()}, ${gameId}, ${wager})`;
      return;
    }
    await withStore((s) => {
      s.game_stats = s.game_stats ?? [];
      let row = s.game_stats.find((x) => String(x.game_id) === gameId);
      if (!row) {
        row = { game_id: gameId, wager_total: 0, bets: 0, updated_at: Date.now() };
        s.game_stats.push(row);
      }
      row.wager_total = Number(row.wager_total) + wager;
      row.bets = Number(row.bets) + 1;
      row.updated_at = Date.now();
      s.game_stat_events = s.game_stat_events ?? [];
      s.nextGameStatEventId = (s.nextGameStatEventId ?? 1) + 1;
      s.game_stat_events.push({ id: s.nextGameStatEventId - 1, ts: Date.now(), game_id: gameId, wager });
    });
  },

  async report(): Promise<Array<{ game_id: string; wager_total: number; bets: number }>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT game_id, wager_total, bets FROM game_stats ORDER BY wager_total DESC`;
      return rows as Array<{ game_id: string; wager_total: number; bets: number }>;
    }
    return withStore((s) =>
      (s.game_stats ?? [])
        .map((x) => ({ game_id: String(x.game_id), wager_total: Number(x.wager_total), bets: Number(x.bets) }))
        .sort((a, b) => b.wager_total - a.wager_total)
    );
  },
};

export const blackjackRepo = {
  async saveTable(
    id: string,
    state: unknown,
    opts: { name: string; isPublic: boolean; createdAt: number }
  ): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO blackjack_tables (id, public, name, state, updated_at, created_at)
        VALUES (${id}, ${opts.isPublic}, ${opts.name}, ${JSON.stringify(state)}, ${Date.now()}, ${opts.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          public = EXCLUDED.public, name = EXCLUDED.name, state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
      `;
      return;
    }
    await withStore((s) => {
      s.blackjack_tables = s.blackjack_tables ?? [];
      const idx = s.blackjack_tables.findIndex((x) => String(x.id) === id);
      const row = { id, public: opts.isPublic, name: opts.name, state, updated_at: Date.now(), created_at: opts.createdAt };
      if (idx >= 0) s.blackjack_tables[idx] = row;
      else s.blackjack_tables.push(row);
    });
  },

  async getTable(id: string): Promise<{ id: string; name: string; public: boolean; state: unknown; updated_at: number; created_at: number } | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT id, name, public, state, updated_at, created_at FROM blackjack_tables WHERE id = ${id}` as unknown as Array<{ id: string; name: string; public: boolean; state: unknown; updated_at: number; created_at: number }>;
      return rows[0] ?? null;
    }
    return withStore((s) => {
      const row = (s.blackjack_tables ?? []).find((x) => String(x.id) === id);
      return (row ?? null) as never;
    });
  },

  async listTables(): Promise<Array<{ id: string; name: string; public: boolean; updated_at: number; created_at: number }>> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT id, name, public, updated_at, created_at FROM blackjack_tables ORDER BY updated_at DESC` as unknown as Array<{ id: string; name: string; public: boolean; updated_at: number; created_at: number }>;
      return rows;
    }
    return withStore((s) =>
      (s.blackjack_tables ?? [])
        .map((x) => ({
          id: String(x.id),
          name: String(x.name),
          public: Boolean(x.public),
          updated_at: Number(x.updated_at),
          created_at: Number(x.created_at),
        }))
        .sort((a, b) => b.updated_at - a.updated_at)
    );
  },

  async deleteTable(id: string): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`DELETE FROM blackjack_tables WHERE id = ${id}`;
      return;
    }
    await withStore((s) => {
      s.blackjack_tables = (s.blackjack_tables ?? []).filter((x) => String(x.id) !== id);
    });
  },

  async getInventory<T = unknown>(userId: number): Promise<T | null> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      const rows = await sql`SELECT inventory FROM blackjack_inventories WHERE user_id = ${userId}` as unknown as Array<{ inventory?: T }>;
      const r = rows[0];
      return (r?.inventory as T | undefined) ?? null;
    }
    return withStore((s) => {
      const row = (s.blackjack_inventories ?? []).find((x) => Number(x.user_id) === userId);
      return (row?.inventory as T | undefined) ?? null;
    });
  },

  async saveInventory(userId: number, inventory: unknown): Promise<void> {
    await ready();
    if (useDatabase) {
      const sql = getSql()!;
      await sql`
        INSERT INTO blackjack_inventories (user_id, inventory, updated_at) VALUES (${userId}, ${JSON.stringify(inventory)}, ${Date.now()})
        ON CONFLICT (user_id) DO UPDATE SET inventory = EXCLUDED.inventory, updated_at = EXCLUDED.updated_at
      `;
      return;
    }
    await withStore((s) => {
      s.blackjack_inventories = s.blackjack_inventories ?? [];
      const idx = s.blackjack_inventories.findIndex((x) => Number(x.user_id) === userId);
      const row = { user_id: userId, inventory, updated_at: Date.now() };
      if (idx >= 0) s.blackjack_inventories[idx] = row;
      else s.blackjack_inventories.push(row);
    });
  },
};
