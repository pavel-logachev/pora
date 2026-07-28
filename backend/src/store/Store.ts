export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  recoveryCodeHash: string | null;
  displayName: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface RefreshTokenInput {
  tokenHash: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  createdAt: Date;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface SyncEventInput {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: JsonObject;
}

export interface StoredSyncEvent extends SyncEventInput {
  serverSequence: number;
  deviceId: string;
}

export interface PushEventsResult {
  acceptedEventIds: string[];
  duplicateEventIds: string[];
  cursor: number;
}

export interface PullEventsResult {
  events: StoredSyncEvent[];
  cursor: number;
  hasMore: boolean;
}

export interface PoraStore {
  createUser(input: {
    email: string;
    passwordHash: string;
    recoveryCodeHash: string;
    displayName: string | null;
    now: Date;
  }): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  resetPassword(input: {
    email: string;
    recoveryCodeHash: string;
    passwordHash: string;
    nextRecoveryCodeHash: string;
    now: Date;
  }): Promise<UserRecord | null>;
  createRefreshToken(input: RefreshTokenInput): Promise<void>;
  rotateRefreshToken(
    oldTokenHash: string,
    replacement: RefreshTokenInput,
    now: Date,
  ): Promise<UserRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  deleteUser(userId: string, now: Date): Promise<void>;
  pushEvents(
    userId: string,
    deviceId: string,
    events: SyncEventInput[],
  ): Promise<PushEventsResult>;
  pullEvents(
    userId: string,
    after: number,
    limit: number,
  ): Promise<PullEventsResult>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}
