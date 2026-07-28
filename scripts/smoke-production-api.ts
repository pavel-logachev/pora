import { randomUUID } from 'node:crypto';

import { poraApiBaseUrl } from '../src/config';
import {
  ApiError,
  PoraApiClient,
  type AuthSession,
  type SessionStore,
} from '../src/sync/apiClient';

class MemorySessionStore implements SessionStore {
  private session: AuthSession | null = null;
  async load() {
    return this.session;
  }
  async save(session: AuthSession) {
    this.session = session;
  }
  async clear() {
    this.session = null;
  }
}

async function main() {
  const id = randomUUID();
  const email = `mobile-smoke-${id}@example.invalid`;
  const password = `Mobile-smoke-${id}`;
  const api = new PoraApiClient({
    baseUrl: poraApiBaseUrl,
    sessionStore: new MemorySessionStore(),
  });

  const session = await api.register(email, password, 'Mobile smoke');
  const pushed = await api.pushEvents('smoke-device', [
    {
      id: `event-${id}`,
      type: 'course.saved',
      aggregateId: `course-${id}`,
      occurredAt: new Date().toISOString(),
      payload: { courseId: `course-${id}` },
    },
  ]);
  const pulled = await api.pullEvents(0, 20);
  const recovered = await api.recover(
    email,
    session.recoveryCode,
    `${password}-new`,
  );
  let oldCodeRejected = false;
  try {
    await api.recover(email, session.recoveryCode, `${password}-newer`);
  } catch (error) {
    oldCodeRejected = error instanceof ApiError && error.status === 401;
  }
  await api.deleteAccount();
  let rejectedAfterDelete = false;
  try {
    await api.login(email, `${password}-new`);
  } catch (error) {
    rejectedAfterDelete = error instanceof ApiError && error.status === 401;
  }

  const result = {
    registered: session.user.email === email,
    accepted: pushed.acceptedEventIds.length === 1,
    pulled: pulled.events.length === 1,
    recoveryRotated: recovered.recoveryCode !== session.recoveryCode,
    oldCodeRejected,
    deleted: rejectedAfterDelete,
  };
  console.log(JSON.stringify(result));
  if (!Object.values(result).every(Boolean)) process.exitCode = 1;
}

void main();
