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
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
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

function openMemoryDatabase() {
  const native = new DatabaseSync(':memory:');
  return { native, database: new NodeSqliteAdapter(native) as unknown as SQLiteDatabase };
}

const nurofen = {
  medicationName: 'Нурофен Экспресс',
  strength: '200 мг',
  form: 'Капсулы',
  catalogSource: 'esklp',
  catalogVersion: 'esklp-2026-07-29-schema-21.5',
  catalogItemUuid: '11111111-2222-3333-4444-555555555555',
  catalogItemCode: '21.20.10.221-000010-1-00174-2000001505218',
  inn: 'ИБУПРОФЕН',
  registrationNumber: 'ЛП-№(010639)-(РГ-RU)',
  manufacturer: 'ПАТЕОН СОФТДЖЕЛС Б.В.',
  dose: '1 капсула',
  startDay: '2026-07-28',
  endDay: null,
  scheduledMinutes: [540],
  stockQuantity: 20,
  stockUnit: 'капсул',
  lowStockThreshold: 5,
};

function userVersion(native: DatabaseSync): number {
  return (native.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

describe('database migrations', () => {
  it('creates the current schema on a new database', async () => {
    const { native, database } = openMemoryDatabase();

    await migrateDatabase(database);

    expect(userVersion(native)).toBe(2);
    const columns = (native.prepare('PRAGMA table_info(medications)').all() as { name: string }[]).map(
      ({ name }) => name,
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        'form',
        'catalog_source',
        'catalog_version',
        'catalog_item_uuid',
        'catalog_item_code',
        'inn',
        'registration_number',
        'manufacturer',
      ]),
    );
    native.close();
  });

  it('upgrades a version 1 database and keeps its courses', async () => {
    const { native, database } = openMemoryDatabase();
    // The shape shipped before the directory existed.
    native.exec(`
      CREATE TABLE medications (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, strength TEXT, form TEXT,
        stock_quantity REAL, stock_unit TEXT, low_stock_threshold REAL, notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE courses (id TEXT PRIMARY KEY NOT NULL, medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        dose TEXT NOT NULL, food_relation TEXT, start_day TEXT NOT NULL, end_day TEXT,
        is_paused INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE course_times (id TEXT PRIMARY KEY NOT NULL, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        scheduled_minutes INTEGER NOT NULL, UNIQUE (course_id, scheduled_minutes));
      CREATE TABLE domain_events (event_id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, aggregate_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL, payload_json TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'pending', server_sequence INTEGER);
      CREATE TABLE notification_jobs (occurrence_id TEXT PRIMARY KEY NOT NULL, notification_id TEXT NOT NULL,
        scheduled_for TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      INSERT INTO medications (id, name, strength, created_at, updated_at)
        VALUES ('m1', 'Телмисартан', '40 мг', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z');
      INSERT INTO courses (id, medication_id, dose, start_day, created_at, updated_at)
        VALUES ('c1', 'm1', '1 таблетка', '2026-07-01', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z');
      INSERT INTO course_times (id, course_id, scheduled_minutes) VALUES ('t1', 'c1', 540);
      PRAGMA user_version = 1;
    `);

    await migrateDatabase(database);

    expect(userVersion(native)).toBe(2);
    const courses = await createSqliteAppRepository(database).listCourses();
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: 'c1', medicationName: 'Телмисартан', strength: '40 мг' });
    expect(courses[0]?.catalogItemUuid).toBeUndefined();
    expect(courses[0]?.inn).toBeUndefined();
    native.close();
  });

  it('can be run again without changing anything', async () => {
    const { native, database } = openMemoryDatabase();

    await migrateDatabase(database);
    await migrateDatabase(database);

    expect(userVersion(native)).toBe(2);
    native.close();
  });

  it('refuses a database written by a newer app', async () => {
    const { native, database } = openMemoryDatabase();
    native.exec('PRAGMA user_version = 9');

    await expect(migrateDatabase(database)).rejects.toThrow('более новой версией');
    native.close();
  });
});

describe('courses with a directory reference', () => {
  async function repositoryWithIds() {
    const { native, database } = openMemoryDatabase();
    await migrateDatabase(database);
    let id = 0;
    const repository = createSqliteAppRepository(database, {
      createId: () => `id-${++id}`,
      now: () => new Date('2026-07-28T06:00:00.000Z'),
    });
    return { native, database, repository };
  }

  it('stores and returns the form and the catalog reference', async () => {
    const { native, repository } = await repositoryWithIds();

    const created = await repository.createCourse(nurofen);
    const [listed] = await repository.listCourses();

    expect(created).toMatchObject({
      form: 'Капсулы',
      catalogSource: 'esklp',
      catalogItemUuid: nurofen.catalogItemUuid,
      inn: 'ИБУПРОФЕН',
      manufacturer: 'ПАТЕОН СОФТДЖЕЛС Б.В.',
    });
    expect(listed).toEqual(created);
    native.close();
  });

  it('sends the reference with the course so another device gets the same medicine', async () => {
    const { native, repository } = await repositoryWithIds();

    await repository.createCourse(nurofen);
    const [event] = await repository.listPendingSyncEvents();

    expect(event?.eventType).toBe('course.saved');
    expect(event?.payload).toMatchObject({
      form: 'Капсулы',
      catalogItemUuid: nurofen.catalogItemUuid,
      inn: 'ИБУПРОФЕН',
    });
    native.close();
  });

  it('applies a remote course with a reference, and an old one without', async () => {
    const source = await repositoryWithIds();
    const created = await source.repository.createCourse(nurofen);
    const target = await repositoryWithIds();

    await target.repository.applyRemoteEvents([
      {
        eventId: 'remote-1',
        eventType: 'course.saved',
        aggregateId: created.id,
        occurredAt: created.updatedAt,
        payload: JSON.parse(JSON.stringify(created)) as Record<string, unknown>,
        serverSequence: 1,
      },
    ]);
    expect(await target.repository.listCourses()).toEqual([created]);

    // A payload from an older app: no form, no reference at all.
    const legacy = {
      id: 'legacy-course',
      medicationId: 'legacy-medication',
      medicationName: 'Телмисартан',
      strength: '40 мг',
      dose: '1 таблетка',
      startDay: '2026-07-01',
      endDay: null,
      isPaused: false,
      scheduledTimes: [{ id: 'legacy-time', scheduledMinutes: 540 }],
      stockQuantity: null,
      stockUnit: null,
      lowStockThreshold: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    await target.repository.applyRemoteEvents([
      {
        eventId: 'remote-2',
        eventType: 'course.saved',
        aggregateId: legacy.id,
        occurredAt: legacy.updatedAt,
        payload: legacy,
        serverSequence: 2,
      },
    ]);
    const legacyCourse = (await target.repository.listCourses()).find(({ id }) => id === legacy.id);
    expect(legacyCourse).toEqual(legacy);
    source.native.close();
    target.native.close();
  });

  it('forgets the reference when a course is edited with a hand-typed name', async () => {
    const { native, repository } = await repositoryWithIds();
    const created = await repository.createCourse(nurofen);

    const updated = await repository.updateCourse(created.id, {
      medicationName: 'Нурофен мой',
      dose: '1 капсула',
      startDay: '2026-07-28',
      endDay: null,
      scheduledMinutes: [540],
      stockQuantity: 20,
      stockUnit: 'капсул',
      lowStockThreshold: 5,
    });

    expect(updated.catalogItemUuid).toBeUndefined();
    expect(updated.inn).toBeUndefined();
    expect(updated.form).toBeUndefined();
    const [listed] = await repository.listCourses();
    expect(listed?.catalogItemUuid).toBeUndefined();
    expect(listed?.manufacturer).toBeUndefined();
    native.close();
  });

  it('keeps the reference when an edit sends it again', async () => {
    const { native, repository } = await repositoryWithIds();
    const created = await repository.createCourse(nurofen);

    const updated = await repository.updateCourse(created.id, { ...nurofen, dose: '2 капсулы' });

    expect(updated).toMatchObject({ dose: '2 капсулы', catalogItemUuid: nurofen.catalogItemUuid, form: 'Капсулы' });
    native.close();
  });

  it('ignores blank reference fields', async () => {
    const { native, repository } = await repositoryWithIds();

    const created = await repository.createCourse({ ...nurofen, inn: '   ', manufacturer: '' });

    expect(created.inn).toBeUndefined();
    expect(created.manufacturer).toBeUndefined();
    native.close();
  });
});
