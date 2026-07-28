import type { AppRepository, SyncEventRecord } from '../data/appRepository';
import type { PoraApiClient } from './apiClient';
import { runSync } from './syncEngine';

const localEvent: SyncEventRecord = {
  eventId: 'local-1',
  eventType: 'course.saved',
  aggregateId: 'course-1',
  occurredAt: '2026-07-28T00:00:00.000Z',
  payload: { id: 'course-1' },
  syncStatus: 'pending',
  serverSequence: null,
};

describe('runSync', () => {
  it('marks accepted and duplicate local events and pulls until the remote cursor is current', async () => {
    const repository = {
      listPendingSyncEvents: jest
        .fn()
        .mockResolvedValueOnce([localEvent])
        .mockResolvedValueOnce([]),
      markSyncEventsSynced: jest.fn(async () => undefined),
      getSyncCursor: jest.fn(async () => 0),
      applyRemoteEvents: jest.fn(async () => undefined),
      setSyncCursor: jest.fn(async () => undefined),
    } as unknown as AppRepository;
    const api = {
      pushEvents: jest.fn(async () => ({
        acceptedEventIds: [],
        duplicateEventIds: ['local-1'],
        cursor: 3,
      })),
      pullEvents: jest
        .fn()
        .mockResolvedValueOnce({
          events: [
            {
              id: 'remote-1',
              type: 'intake.taken',
              aggregateId: 'dose-1',
              occurredAt: '2026-07-28T01:00:00.000Z',
              payload: { type: 'taken', doseId: 'dose-1' },
              serverSequence: 2,
            },
          ],
          cursor: 2,
          hasMore: true,
        })
        .mockResolvedValueOnce({ events: [], cursor: 3, hasMore: false }),
    } as unknown as PoraApiClient;

    const result = await runSync(repository, api, 'device-1');

    expect(repository.markSyncEventsSynced).toHaveBeenCalledWith(['local-1'], 3);
    expect(repository.applyRemoteEvents).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          eventId: 'remote-1',
          serverSequence: 2,
        }),
      ],
    );
    expect(repository.applyRemoteEvents).toHaveBeenNthCalledWith(2, []);
    expect(repository.setSyncCursor).toHaveBeenNthCalledWith(1, 2);
    expect(repository.setSyncCursor).toHaveBeenNthCalledWith(2, 3);
    expect(result).toEqual({ pushed: 1, pulled: 1, cursor: 3 });
  });
});
