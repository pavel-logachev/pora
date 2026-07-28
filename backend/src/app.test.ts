import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { InMemoryPoraStore } from './store/inMemoryStore.js';

const config = {
  appEnv: 'test' as const,
  jwtSecret: 'test-secret-with-at-least-thirty-two-characters',
  jwtIssuer: 'pora-api',
  jwtAudience: 'pora-mobile',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  corsOrigins: [] as string[],
};

describe('auth API', () => {
  const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup() {
    const app = await buildApp({ config, store: new InMemoryPoraStore() });
    apps.push(app);
    return app;
  }

  it('serves the public privacy and terms pages', async () => {
    const app = await setup();
    const privacy = await app.inject({ method: 'GET', url: '/legal/privacy' });
    const terms = await app.inject({ method: 'GET', url: '/legal/terms' });
    expect(privacy.statusCode).toBe(200);
    expect(privacy.headers['content-type']).toContain('text/html');
    expect(privacy.body).toContain('Конфиденциальность');
    expect(terms.statusCode).toBe(200);
    expect(terms.body).toContain('не заменяет врача');
  });

  it('registers a normalized email and returns an authenticated session', async () => {
    const app = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: '  FRIEND@Example.com ',
        password: 'a-secure-password',
        displayName: '  Анна  ',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      user: { email: 'friend@example.com', displayName: 'Анна' },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      recoveryCode: expect.any(String),
      expiresIn: 900,
    });
  });

  it('uses one structured error shape for duplicate and invalid credentials', async () => {
    const app = await setup();
    const payload = {
      email: 'friend@example.com',
      password: 'a-secure-password',
    };
    expect(
      (await app.inject({ method: 'POST', url: '/v1/auth/register', payload }))
        .statusCode,
    ).toBe(201);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({
      error: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Аккаунт с таким email уже существует',
      },
    });

    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { ...payload, password: 'wrong-password' },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль',
      },
    });
  });

  it('recovers a password once and rotates the recovery code', async () => {
    const app = await setup();
    const registered = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'friend@example.com',
        password: 'a-secure-password',
      },
    });
    const firstSession = registered.json();

    const recovered = await app.inject({
      method: 'POST',
      url: '/v1/auth/recover',
      payload: {
        email: 'friend@example.com',
        recoveryCode: firstSession.recoveryCode,
        newPassword: 'a-new-secure-password',
      },
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().recoveryCode).not.toBe(firstSession.recoveryCode);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: {
            email: 'friend@example.com',
            password: 'a-secure-password',
          },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: {
            email: 'friend@example.com',
            password: 'a-new-secure-password',
          },
        })
      ).statusCode,
    ).toBe(200);

    const reusedCode = await app.inject({
      method: 'POST',
      url: '/v1/auth/recover',
      payload: {
        email: 'friend@example.com',
        recoveryCode: firstSession.recoveryCode,
        newPassword: 'another-secure-password',
      },
    });
    expect(reusedCode.statusCode).toBe(401);
  });

  it('rotates refresh tokens and rejects reuse of the old token', async () => {
    const app = await setup();
    const registered = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'friend@example.com',
        password: 'a-secure-password',
      },
    });
    const firstSession = registered.json();

    const refreshed = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: firstSession.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refreshToken).not.toBe(firstSession.refreshToken);

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: firstSession.refreshToken },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('returns the current user only with a valid access token', async () => {
    const app = await setup();
    const registered = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'friend@example.com',
        password: 'a-secure-password',
      },
    });

    const unauthorized = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        authorization: `Bearer ${registered.json().accessToken}`,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ email: 'friend@example.com' });
  });
});
