import {
  PoraApiClient,
  type AuthSession,
  type SessionStore,
} from './apiClient';

class MemorySessionStore implements SessionStore {
  value: AuthSession | null = null;

  async load() {
    return this.value;
  }

  async save(session: AuthSession) {
    this.value = session;
  }

  async clear() {
    this.value = null;
  }
}

const user = {
  id: 'user-1',
  email: 'friend@example.com',
  displayName: 'Друг',
  createdAt: '2026-07-28T00:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PoraApiClient', () => {
  it('registers and stores the resulting session', async () => {
    const store = new MemorySessionStore();
    const fetcher = jest.fn(async () =>
      jsonResponse(201, {
        user,
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        expiresIn: 900,
        recoveryCode: 'one-time-code',
      }),
    );
    const client = new PoraApiClient({
      baseUrl: 'https://pora.example',
      sessionStore: store,
      fetcher,
    });

    const session = await client.register(
      ' Friend@Example.com ',
      'correct-password',
      'Друг',
    );

    expect(session.user.email).toBe('friend@example.com');
    expect(session.recoveryCode).toBe('one-time-code');
    expect(store.value?.refreshToken).toBe('refresh-new');
    expect(
      (store.value as AuthSession & { recoveryCode?: string } | null)?.recoveryCode,
    ).toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      'https://pora.example/v1/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rotates the refresh token once and retries an authenticated request', async () => {
    const store = new MemorySessionStore();
    store.value = {
      user,
      accessToken: 'access-old',
      refreshToken: 'refresh-old',
      expiresIn: 900,
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user,
          accessToken: 'access-rotated',
          refreshToken: 'refresh-rotated',
          expiresIn: 900,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, user));
    const client = new PoraApiClient({
      baseUrl: 'https://pora.example',
      sessionStore: store,
      fetcher: fetcher as typeof fetch,
    });
    await client.loadSession();

    const currentUser = await client.getCurrentUser();

    expect(currentUser.email).toBe('friend@example.com');
    expect(store.value?.refreshToken).toBe('refresh-rotated');
    const retryHeaders = new Headers(fetcher.mock.calls[2]?.[1]?.headers);
    expect(retryHeaders.get('authorization')).toBe('Bearer access-rotated');
  });
});
