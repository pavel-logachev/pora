import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from './database';
import { createSqliteAppRepository } from './sqliteAppRepository';

class NodeSqliteAdapter {
  constructor(private readonly database: DatabaseSync) {}

  async execAsync(source: string) {
    this.database.exec(source);
  }

  async runAsync(source: string, ...params: unknown[]) {
    const result = this.prepare(source).run(...this.bindable(params));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    return (this.prepare(source).get(...this.bindable(params)) as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    return this.prepare(source).all(...this.bindable(params)) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>) {
    this.database.exec('BEGIN');
    try {
      await task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private prepare(source: string): StatementSync {
    return this.database.prepare(source);
  }

  private bindable(values: unknown[]) {
    return values as Array<string | number | bigint | null | Uint8Array>;
  }
}

describe('SQLite app repository', () => {
  it('persists courses and intake events and exposes an idempotent sync outbox', async () => {
    const nativeDatabase = new DatabaseSync(':memory:');
    const database = new NodeSqliteAdapter(
      nativeDatabase,
    ) as unknown as SQLiteDatabase;
    await migrateDatabase(database);

    let id = 0;
    const createId = () => `generated-id-${++id}`;
    const now = () => new Date('2026-07-28T06:00:00.000Z');
    const repository = createSqliteAppRepository(database, { createId, now });

    const created = await repository.createCourse({
      medicationName: 'Телмисартан',
      strength: '40 мг',
      dose: '1 таблетка',
      foodRelation: 'после завтрака',
      startDay: '2026-07-28',
      endDay: null,
      scheduledMinutes: [540, 1260],
      stockQuantity: 28,
      stockUnit: 'таблеток',
      lowStockThreshold: 5,
    });

    const restartedRepository = createSqliteAppRepository(database, {
      createId,
      now,
    });
    await restartedRepository.appendMedicationEvent({
      id: 'intake-event-1',
      type: 'taken',
      doseId: created.scheduledTimes[0].id,
      dayKey: '2026-07-28',
      recordedAt: '2026-07-28T06:05:00.000Z',
    });

    expect(await restartedRepository.listCourses()).toEqual([created]);
    expect(await restartedRepository.loadMedicationEvents()).toEqual([
      {
        id: 'intake-event-1',
        type: 'taken',
        doseId: created.scheduledTimes[0].id,
        dayKey: '2026-07-28',
        recordedAt: '2026-07-28T06:05:00.000Z',
        medicationName: 'Телмисартан',
        strength: '40 мг',
        dose: '1 таблетка',
      },
    ]);

    const pending = await restartedRepository.listPendingSyncEvents();
    expect(pending.map(({ eventType }) => eventType)).toEqual([
      'course.saved',
      'intake.taken',
    ]);

    await restartedRepository.markSyncEventsSynced(
      pending.map(({ eventId }) => eventId),
      42,
    );
    expect(await restartedRepository.listPendingSyncEvents()).toEqual([]);

    const updated = await restartedRepository.updateCourse(created.id, {
      medicationName: 'Телмисартан',
      strength: '40 мг',
      dose: '1 таблетка',
      foodRelation: 'после завтрака',
      startDay: '2026-07-28',
      endDay: null,
      scheduledMinutes: [540],
      stockQuantity: 17,
      stockUnit: 'таблеток',
      lowStockThreshold: 5,
    });
    await restartedRepository.setCoursePaused(updated.id, true);

    expect(await restartedRepository.listCourses()).toEqual([
      expect.objectContaining({
        id: created.id,
        isPaused: true,
        stockQuantity: 17,
        scheduledTimes: [created.scheduledTimes[0]],
      }),
    ]);

    await restartedRepository.deleteCourse(created.id);
    expect(await restartedRepository.listCourses()).toEqual([]);
    expect(await restartedRepository.loadMedicationEvents()).toEqual([
      expect.objectContaining({
        id: 'intake-event-1',
        medicationName: 'Телмисартан',
        strength: '40 мг',
        dose: '1 таблетка',
      }),
    ]);

    nativeDatabase.close();
  });
});
