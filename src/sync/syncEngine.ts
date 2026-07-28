import type { AppRepository, SyncEventRecord } from '../data/appRepository';
import type { RemoteSyncEvent } from '../data/appRepository';
import type { ApiSyncEvent, PoraApiClient } from './apiClient';

function toApiEvent(event: SyncEventRecord): ApiSyncEvent {
  return {
    id: event.eventId,
    type: event.eventType,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt,
    payload: event.payload,
  };
}

function toRepositoryEvent(event: ApiSyncEvent): RemoteSyncEvent {
  if (!Number.isInteger(event.serverSequence)) {
    throw new Error('Сервер не указал последовательность события');
  }
  return {
    eventId: event.id,
    eventType: event.type,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt,
    payload: event.payload,
    serverSequence: event.serverSequence as number,
  };
}

export async function runSync(
  repository: AppRepository,
  api: PoraApiClient,
  deviceId: string,
) {
  let pushed = 0;
  while (true) {
    const pending = await repository.listPendingSyncEvents(200);
    if (pending.length === 0) break;
    const result = await api.pushEvents(deviceId, pending.map(toApiEvent));
    const completed = [
      ...result.acceptedEventIds,
      ...result.duplicateEventIds,
    ];
    if (completed.length === 0) {
      throw new Error('Сервер не подтвердил пакет синхронизации');
    }
    await repository.markSyncEventsSynced(completed, result.cursor);
    pushed += completed.length;
    if (pending.length < 200) break;
  }

  let cursor = await repository.getSyncCursor();
  let pulled = 0;
  for (let page = 0; page < 100; page += 1) {
    const result = await api.pullEvents(cursor, 200);
    const remoteEvents = result.events.map(toRepositoryEvent);
    await repository.applyRemoteEvents(remoteEvents);
    await repository.setSyncCursor(result.cursor);
    pulled += remoteEvents.length;
    if (!result.hasMore) {
      cursor = result.cursor;
      return { pushed, pulled, cursor };
    }
    if (result.cursor <= cursor) {
      throw new Error('Сервер вернул некорректный курсор синхронизации');
    }
    cursor = result.cursor;
  }
  throw new Error('Превышен лимит страниц синхронизации');
}
