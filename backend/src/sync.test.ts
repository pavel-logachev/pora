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

async function register(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: 'a-secure-password' },
  });
  return response.json().accessToken as string;
}

describe('sync API', () => {
  const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('pushes idempotent events and pulls only the authenticated user stream', async () => {
    const app = await buildApp({ config, store: new InMemoryPoraStore() });
    apps.push(app);
    const firstToken = await register(app, 'first@example.com');
    const secondToken = await register(app, 'second@example.com');
    const payload = {
      deviceId: 'phone-a',
      events: [
        {
          id: 'event-1',
          type: 'course.saved',
          aggregateId: 'course-1',
          occurredAt: '2026-07-28T08:00:00.000Z',
          payload: { medicationName: 'Телмисартан' },
        },
        {
          id: 'event-2',
          type: 'intake.taken',
          aggregateId: 'dose-1',
          occurredAt: '2026-07-28T09:00:00.000Z',
          payload: { dayKey: '2026-07-28' },
        },
      ],
    };

    const pushed = await app.inject({
      method: 'POST',
      url: '/v1/sync/events',
      headers: { authorization: `Bearer ${firstToken}` },
      payload,
    });
    expect(pushed.statusCode).toBe(200);
    expect(pushed.json()).toMatchObject({
      acceptedEventIds: ['event-1', 'event-2'],
      duplicateEventIds: [],
      cursor: 2,
    });

    const repeated = await app.inject({
      method: 'POST',
      url: '/v1/sync/events',
      headers: { authorization: `Bearer ${firstToken}` },
      payload,
    });
    expect(repeated.json()).toMatchObject({
      acceptedEventIds: [],
      duplicateEventIds: ['event-1', 'event-2'],
      cursor: 2,
    });

    const pulled = await app.inject({
      method: 'GET',
      url: '/v1/sync/events?after=0&limit=1',
      headers: { authorization: `Bearer ${firstToken}` },
    });
    expect(pulled.statusCode).toBe(200);
    expect(pulled.json()).toMatchObject({
      cursor: 1,
      hasMore: true,
      events: [{ id: 'event-1', serverSequence: 1 }],
    });

    const isolated = await app.inject({
      method: 'GET',
      url: '/v1/sync/events?after=0',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(isolated.json()).toEqual({ events: [], cursor: 0, hasMore: false });
  });

  it('rejects an invalid event batch at the HTTP boundary', async () => {
    const app = await buildApp({ config, store: new InMemoryPoraStore() });
    apps.push(app);
    const token = await register(app, 'first@example.com');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sync/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { deviceId: '', events: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
