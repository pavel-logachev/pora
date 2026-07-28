export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RecoverySession extends AuthSession {
  recoveryCode: string;
}

export interface SessionStore {
  load(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiSyncEvent {
  id: string;
  type: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  deviceId?: string;
  serverSequence?: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface PoraApiClientOptions {
  baseUrl: string;
  sessionStore: SessionStore;
  fetcher?: typeof fetch;
  onSessionChanged?: (session: AuthSession | null) => void;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = body as
      | { error?: { code?: string; message?: string } }
      | undefined;
    throw new ApiError(
      response.status,
      error?.error?.code ?? 'HTTP_ERROR',
      error?.error?.message ?? 'Сервер временно недоступен',
    );
  }
  return body as T;
}

export class PoraApiClient {
  private readonly baseUrl: string;
  private readonly sessionStore: SessionStore;
  private readonly fetcher: typeof fetch;
  private readonly onSessionChanged?: (session: AuthSession | null) => void;
  private session: AuthSession | null = null;

  constructor(options: PoraApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.sessionStore = options.sessionStore;
    this.fetcher = options.fetcher ?? fetch;
    this.onSessionChanged = options.onSessionChanged;
  }

  getSession() {
    return this.session;
  }

  async loadSession() {
    this.session = await this.sessionStore.load();
    this.onSessionChanged?.(this.session);
    return this.session;
  }

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<RecoverySession> {
    const session = await this.publicJson<RecoverySession>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLocaleLowerCase('ru-RU'),
        password,
        ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
      }),
    });
    await this.setSession(session);
    return session;
  }

  async recover(
    email: string,
    recoveryCode: string,
    newPassword: string,
  ): Promise<RecoverySession> {
    const session = await this.publicJson<RecoverySession>('/v1/auth/recover', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLocaleLowerCase('ru-RU'),
        recoveryCode: recoveryCode.trim(),
        newPassword,
      }),
    });
    await this.setSession(session);
    return session;
  }

  async login(email: string, password: string) {
    const session = await this.publicJson<AuthSession>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLocaleLowerCase('ru-RU'),
        password,
      }),
    });
    await this.setSession(session);
    return session;
  }

  async getCurrentUser() {
    return this.authenticatedJson<AuthUser>('/v1/me', { method: 'GET' });
  }

  async logout() {
    const session = this.session;
    try {
      if (session) {
        await this.publicJson<void>('/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      }
    } finally {
      await this.setSession(null);
    }
  }

  async deleteAccount() {
    await this.authenticatedJson<void>('/v1/account', { method: 'DELETE' });
    await this.setSession(null);
  }

  async pushEvents(deviceId: string, events: ApiSyncEvent[]) {
    return this.authenticatedJson<{
      acceptedEventIds: string[];
      duplicateEventIds: string[];
      cursor: number;
    }>('/v1/sync/events', {
      method: 'POST',
      body: JSON.stringify({ deviceId, events }),
    });
  }

  async pullEvents(after: number, limit = 200) {
    return this.authenticatedJson<{
      events: ApiSyncEvent[];
      cursor: number;
      hasMore: boolean;
    }>(`/v1/sync/events?after=${after}&limit=${limit}`, { method: 'GET' });
  }

  private async refreshSession() {
    const current = this.session;
    if (!current) throw new ApiError(401, 'UNAUTHORIZED', 'Войдите в аккаунт');
    try {
      const next = await this.publicJson<AuthSession>('/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      await this.setSession(next);
      return next;
    } catch (error) {
      await this.setSession(null);
      throw error;
    }
  }

  private async authenticatedJson<T>(path: string, init: RequestInit) {
    if (!this.session) throw new ApiError(401, 'UNAUTHORIZED', 'Войдите в аккаунт');
    let response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${this.session.accessToken}`,
        ...init.headers,
      },
    });
    if (response.status === 401) {
      const session = await this.refreshSession();
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          authorization: `Bearer ${session.accessToken}`,
          ...init.headers,
        },
      });
    }
    return parseResponse<T>(response);
  }

  private async publicJson<T>(path: string, init: RequestInit) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return parseResponse<T>(response);
  }

  private async setSession(session: AuthSession | null) {
    const safeSession = session
      ? {
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
        }
      : null;
    this.session = safeSession;
    if (safeSession) await this.sessionStore.save(safeSession);
    else await this.sessionStore.clear();
    this.onSessionChanged?.(safeSession);
  }
}
