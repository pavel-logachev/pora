import { randomUUID } from 'node:crypto';

import type {
  PoraStore,
  PullEventsResult,
  PushEventsResult,
  RefreshTokenInput,
  StoredSyncEvent,
  SyncEventInput,
  UserRecord,
} from './Store.js';

interface StoredRefreshToken extends RefreshTokenInput {
  revokedAt: Date | null;
  replacedByHash: string | null;
}

interface OwnedSyncEvent extends StoredSyncEvent {
  userId: string;
}

export class InMemoryPoraStore implements PoraStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly refreshTokens = new Map<string, StoredRefreshToken>();
  private readonly events: OwnedSyncEvent[] = [];
  private nextSequence = 1;

  async createUser(input: {
    email: string;
    passwordHash: string;
    recoveryCodeHash: string;
    displayName: string | null;
    now: Date;
  }): Promise<UserRecord | null> {
    if (
      [...this.users.values()].some(
        (user) => user.deletedAt === null && user.email === input.email,
      )
    ) {
      return null;
    }
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      recoveryCodeHash: input.recoveryCodeHash,
      displayName: input.displayName,
      createdAt: input.now,
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email && candidate.deletedAt === null,
    );
    return user ? { ...user } : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user && user.deletedAt === null ? { ...user } : null;
  }

  async resetPassword(input: {
    email: string;
    recoveryCodeHash: string;
    passwordHash: string;
    nextRecoveryCodeHash: string;
    now: Date;
  }): Promise<UserRecord | null> {
    const user = [...this.users.values()].find(
      (candidate) =>
        candidate.email === input.email &&
        candidate.deletedAt === null &&
        candidate.recoveryCodeHash === input.recoveryCodeHash,
    );
    if (!user) return null;
    user.passwordHash = input.passwordHash;
    user.recoveryCodeHash = input.nextRecoveryCodeHash;
    for (const token of this.refreshTokens.values()) {
      if (token.userId === user.id && token.revokedAt === null) {
        token.revokedAt = input.now;
      }
    }
    return { ...user };
  }

  async createRefreshToken(input: RefreshTokenInput): Promise<void> {
    this.refreshTokens.set(input.tokenHash, {
      ...input,
      revokedAt: null,
      replacedByHash: null,
    });
  }

  async rotateRefreshToken(
    oldTokenHash: string,
    replacement: RefreshTokenInput,
    now: Date,
  ): Promise<UserRecord | null> {
    const current = this.refreshTokens.get(oldTokenHash);
    if (
      !current ||
      current.revokedAt !== null ||
      current.replacedByHash !== null ||
      current.expiresAt <= now
    ) {
      if (current) this.revokeFamily(current.familyId, now);
      return null;
    }
    const user = this.users.get(current.userId);
    if (!user || user.deletedAt !== null) return null;

    current.revokedAt = now;
    current.replacedByHash = replacement.tokenHash;
    this.refreshTokens.set(replacement.tokenHash, {
      ...replacement,
      userId: current.userId,
      familyId: current.familyId,
      revokedAt: null,
      replacedByHash: null,
    });
    return { ...user };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const token = this.refreshTokens.get(tokenHash);
    if (token && token.revokedAt === null) token.revokedAt = new Date();
  }

  async deleteUser(userId: string, now: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.deletedAt = now;
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && token.revokedAt === null) token.revokedAt = now;
    }
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (this.events[index]?.userId === userId) this.events.splice(index, 1);
    }
  }

  async pushEvents(
    userId: string,
    deviceId: string,
    events: SyncEventInput[],
  ): Promise<PushEventsResult> {
    const acceptedEventIds: string[] = [];
    const duplicateEventIds: string[] = [];
    for (const event of events) {
      if (
        this.events.some(
          (stored) => stored.userId === userId && stored.eventId === event.eventId,
        )
      ) {
        duplicateEventIds.push(event.eventId);
        continue;
      }
      this.events.push({
        ...event,
        userId,
        deviceId,
        serverSequence: this.nextSequence,
      });
      this.nextSequence += 1;
      acceptedEventIds.push(event.eventId);
    }
    const cursor = this.latestCursor(userId);
    return { acceptedEventIds, duplicateEventIds, cursor };
  }

  async pullEvents(
    userId: string,
    after: number,
    limit: number,
  ): Promise<PullEventsResult> {
    const matching = this.events
      .filter(
        (event) => event.userId === userId && event.serverSequence > after,
      )
      .sort((left, right) => left.serverSequence - right.serverSequence);
    const page = matching.slice(0, limit);
    return {
      events: page.map(({ userId: _userId, ...event }) => ({ ...event })),
      cursor: page.at(-1)?.serverSequence ?? after,
      hasMore: matching.length > page.length,
    };
  }

  async ping(): Promise<void> {}

  async close(): Promise<void> {}

  private latestCursor(userId: string) {
    return this.events
      .filter((event) => event.userId === userId)
      .reduce((cursor, event) => Math.max(cursor, event.serverSequence), 0);
  }

  private revokeFamily(familyId: string, now: Date) {
    for (const token of this.refreshTokens.values()) {
      if (token.familyId === familyId && token.revokedAt === null) {
        token.revokedAt = now;
      }
    }
  }
}
