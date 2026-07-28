import type { MedicationEvent } from '../domain/medicationDay';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface MedicationEventRepository {
  loadEvents(): Promise<MedicationEvent[]>;
  appendEvent(event: MedicationEvent): Promise<void>;
}

export function createMedicationEventRepository(
  storage: KeyValueStorage,
  storageKey = 'pora.medication-events.v1',
): MedicationEventRepository {
  async function loadEvents(): Promise<MedicationEvent[]> {
    const serialized = await storage.getItem(storageKey);
    return serialized ? (JSON.parse(serialized) as MedicationEvent[]) : [];
  }

  let writeQueue: Promise<void> = Promise.resolve();

  return {
    loadEvents,
    appendEvent(event) {
      const operation = writeQueue.then(async () => {
        const events = await loadEvents();
        await storage.setItem(storageKey, JSON.stringify([...events, event]));
      });
      writeQueue = operation.catch(() => undefined);
      return operation;
    },
  };
}
