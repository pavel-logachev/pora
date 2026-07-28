import type { MedicationEvent } from '../domain/medicationDay';
import { createMedicationEventRepository } from './medicationEventRepository';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('MedicationEventRepository', () => {
  it('persists events in order and loads them for the next app start', async () => {
    const repository = createMedicationEventRepository(createMemoryStorage(), 'events');
    const events: MedicationEvent[] = [
      {
        id: 'taken-vitamin',
        type: 'taken',
        doseId: 'vitamin-d3-0730',
        recordedAt: '2026-07-28T07:34:00.000Z',
      },
      {
        id: 'postpone-telmisartan',
        type: 'postponed',
        doseId: 'telmisartan-0900',
        recordedAt: '2026-07-28T09:02:00.000Z',
        minutes: 10,
      },
    ];

    await repository.appendEvent(events[0]);
    await repository.appendEvent(events[1]);

    await expect(repository.loadEvents()).resolves.toEqual(events);
  });

  it('serializes simultaneous appends so a rapid undo cannot overwrite an action', async () => {
    const repository = createMedicationEventRepository(createMemoryStorage(), 'events');
    const taken: MedicationEvent = {
      id: 'taken-telmisartan',
      type: 'taken',
      doseId: 'telmisartan-0900',
      recordedAt: '2026-07-28T09:02:00.000Z',
    };
    const undone: MedicationEvent = {
      id: 'undo-telmisartan',
      type: 'undone',
      targetEventId: taken.id,
      recordedAt: '2026-07-28T09:02:01.000Z',
    };

    await Promise.all([
      repository.appendEvent(taken),
      repository.appendEvent(undone),
    ]);

    await expect(repository.loadEvents()).resolves.toEqual([taken, undone]);
  });
});
