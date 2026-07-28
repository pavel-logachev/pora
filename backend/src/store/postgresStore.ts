import postgres from 'postgres';

import type {
  PoraStore,
  PullEventsResult,
  PushEventsResult,
  RefreshTokenInput,
  SyncEventInput,
  UserRecord,
} from './Store.js';

type SqlClient = ReturnType<typeof postgres>;
type Row = Record<string, unknown>;

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value);
}

function mapUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    recoveryCodeHash:
      row.recovery_code_hash === null || row.recovery_code_hash === undefined
        ? null
        : String(row.recovery_code_hash),
    displayName: row.display_name === null ? null : String(row.display_name),
    createdAt: asDate(row.created_at),
    deletedAt: row.deleted_at === null ? null : asDate(row.deleted_at),
  };
}

export class PostgresPoraStore implements PoraStore {
  constructor(private readonly sql: SqlClient) {}

  static connect(databaseUrl: string) {
    return new PostgresPoraStore(
      postgres(databaseUrl, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      }),
    );
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    recoveryCodeHash: string;
    displayName: string | null;
    now: Date;
  }): Promise<UserRecord | null> {
    const rows = await this.sql<Row[]>`
      INSERT INTO users
        (email, password_hash, recovery_code_hash, display_name, created_at)
      VALUES
        (${input.email}, ${input.passwordHash}, ${input.recoveryCodeHash}, ${input.displayName}, ${input.now})
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.sql<Row[]>`
      SELECT * FROM users
      WHERE email = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.sql<Row[]>`
      SELECT * FROM users
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async resetPassword(input: {
    email: string;
    recoveryCodeHash: string;
    passwordHash: string;
    nextRecoveryCodeHash: string;
    now: Date;
  }): Promise<UserRecord | null> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<Row[]>`
        UPDATE users
        SET password_hash = ${input.passwordHash},
            recovery_code_hash = ${input.nextRecoveryCodeHash}
        WHERE email = ${input.email}
          AND recovery_code_hash = ${input.recoveryCodeHash}
          AND deleted_at IS NULL
        RETURNING *
      `;
      const user = rows[0];
      if (!user) return null;
      await transaction`
        UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, ${input.now})
        WHERE user_id = ${String(user.id)}
      `;
      return mapUser(user);
    });
  }

  async createRefreshToken(input: RefreshTokenInput): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens
        (token_hash, user_id, family_id, expires_at, created_at)
      VALUES
        (${input.tokenHash}, ${input.userId}, ${input.familyId}, ${input.expiresAt}, ${input.createdAt})
    `;
  }

  async rotateRefreshToken(
    oldTokenHash: string,
    replacement: RefreshTokenInput,
    now: Date,
  ): Promise<UserRecord | null> {
    return this.sql.begin(async (transaction) => {
      const tokenRows = await transaction<Row[]>`
        SELECT * FROM refresh_tokens
        WHERE token_hash = ${oldTokenHash}
        FOR UPDATE
      `;
      const current = tokenRows[0];
      if (!current) return null;

      const invalid =
        current.revoked_at !== null ||
        current.replaced_by_hash !== null ||
        asDate(current.expires_at) <= now;
      if (invalid) {
        await transaction`
          UPDATE refresh_tokens
          SET revoked_at = COALESCE(revoked_at, ${now})
          WHERE family_id = ${String(current.family_id)}
        `;
        return null;
      }

      await transaction`
        INSERT INTO refresh_tokens
          (token_hash, user_id, family_id, expires_at, created_at)
        VALUES
          (
            ${replacement.tokenHash},
            ${String(current.user_id)},
            ${String(current.family_id)},
            ${replacement.expiresAt},
            ${replacement.createdAt}
          )
      `;
      await transaction`
        UPDATE refresh_tokens
        SET revoked_at = ${now}, replaced_by_hash = ${replacement.tokenHash}
        WHERE token_hash = ${oldTokenHash}
      `;
      const userRows = await transaction<Row[]>`
        SELECT * FROM users
        WHERE id = ${String(current.user_id)} AND deleted_at IS NULL
        LIMIT 1
      `;
      return userRows[0] ? mapUser(userRows[0]) : null;
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_hash = ${tokenHash}
    `;
  }

  async deleteUser(userId: string, _now: Date): Promise<void> {
    await this.sql`DELETE FROM users WHERE id = ${userId}`;
  }

  async pushEvents(
    userId: string,
    deviceId: string,
    events: SyncEventInput[],
  ): Promise<PushEventsResult> {
    return this.sql.begin(async (transaction) => {
      const acceptedEventIds: string[] = [];
      const duplicateEventIds: string[] = [];
      for (const event of events) {
        const inserted = await transaction<Row[]>`
          INSERT INTO sync_events
            (user_id, event_id, event_type, aggregate_id, occurred_at, payload, device_id)
          VALUES
            (
              ${userId},
              ${event.eventId},
              ${event.eventType},
              ${event.aggregateId},
              ${event.occurredAt},
              ${transaction.json(event.payload)},
              ${deviceId}
            )
          ON CONFLICT (user_id, event_id) DO NOTHING
          RETURNING server_sequence
        `;
        if (inserted[0]) acceptedEventIds.push(event.eventId);
        else duplicateEventIds.push(event.eventId);
      }
      const cursorRows = await transaction<Row[]>`
        SELECT COALESCE(MAX(server_sequence), 0) AS cursor
        FROM sync_events
        WHERE user_id = ${userId}
      `;
      return {
        acceptedEventIds,
        duplicateEventIds,
        cursor: asNumber(cursorRows[0]?.cursor ?? 0),
      };
    });
  }

  async pullEvents(
    userId: string,
    after: number,
    limit: number,
  ): Promise<PullEventsResult> {
    const rows = await this.sql<Row[]>`
      SELECT
        server_sequence,
        event_id,
        event_type,
        aggregate_id,
        occurred_at,
        payload,
        device_id
      FROM sync_events
      WHERE user_id = ${userId} AND server_sequence > ${after}
      ORDER BY server_sequence ASC
      LIMIT ${limit + 1}
    `;
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const events = page.map((row) => ({
      serverSequence: asNumber(row.server_sequence),
      eventId: String(row.event_id),
      eventType: String(row.event_type),
      aggregateId: String(row.aggregate_id),
      occurredAt: asDate(row.occurred_at),
      payload: row.payload as SyncEventInput['payload'],
      deviceId: String(row.device_id),
    }));
    return {
      events,
      cursor: events.at(-1)?.serverSequence ?? after,
      hasMore,
    };
  }

  async ping(): Promise<void> {
    await this.sql`SELECT 1`;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
