import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  normalizeCourseInput,
  type MedicationCourse,
  type NewMedicationCourseInput,
} from '../domain/medicationCourse';
import type { MedicationEvent } from '../domain/medicationDay';
import type {
  AppRepository,
  RemoteSyncEvent,
  SyncEventRecord,
} from './appRepository';

interface CourseRow {
  id: string;
  medication_id: string;
  medication_name: string;
  strength: string | null;
  stock_quantity: number | null;
  stock_unit: string | null;
  low_stock_threshold: number | null;
  dose: string;
  food_relation: string | null;
  start_day: string;
  end_day: string | null;
  is_paused: number;
  created_at: string;
  updated_at: string;
}

interface CourseTimeRow {
  id: string;
  course_id: string;
  scheduled_minutes: number;
}

interface EventRow {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  occurred_at: string;
  payload_json: string;
  sync_status: 'pending' | 'synced';
  server_sequence: number | null;
}

export interface AppRepositoryDependencies {
  createId?: () => string;
  now?: () => Date;
}

function asPayload(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function parsePayload(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Повреждена локальная запись события');
  }
  return parsed as Record<string, unknown>;
}

async function writeCourseProjection(
  db: SQLiteDatabase,
  course: MedicationCourse,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO medications (
      id, name, strength, stock_quantity, stock_unit, low_stock_threshold,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      strength = excluded.strength,
      stock_quantity = excluded.stock_quantity,
      stock_unit = excluded.stock_unit,
      low_stock_threshold = excluded.low_stock_threshold,
      is_archived = 0,
      updated_at = excluded.updated_at`,
    course.medicationId,
    course.medicationName,
    course.strength ?? null,
    course.stockQuantity,
    course.stockUnit,
    course.lowStockThreshold,
    course.createdAt,
    course.updatedAt,
  );

  await db.runAsync(
    `INSERT INTO courses (
      id, medication_id, dose, food_relation, start_day, end_day,
      is_paused, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      medication_id = excluded.medication_id,
      dose = excluded.dose,
      food_relation = excluded.food_relation,
      start_day = excluded.start_day,
      end_day = excluded.end_day,
      is_paused = excluded.is_paused,
      updated_at = excluded.updated_at`,
    course.id,
    course.medicationId,
    course.dose,
    course.foodRelation ?? null,
    course.startDay,
    course.endDay,
    course.isPaused ? 1 : 0,
    course.createdAt,
    course.updatedAt,
  );

  await db.runAsync('DELETE FROM course_times WHERE course_id = ?', course.id);
  for (const time of course.scheduledTimes) {
    await db.runAsync(
      `INSERT INTO course_times (id, course_id, scheduled_minutes)
       VALUES (?, ?, ?)`,
      time.id,
      course.id,
      time.scheduledMinutes,
    );
  }
}

async function insertDomainEvent(
  db: SQLiteDatabase,
  event: {
    eventId: string;
    eventType: string;
    aggregateId: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    syncStatus: 'pending' | 'synced';
    serverSequence?: number | null;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO domain_events (
      event_id, event_type, aggregate_id, occurred_at, payload_json,
      sync_status, server_sequence
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      sync_status = CASE
        WHEN excluded.sync_status = 'synced' THEN 'synced'
        ELSE domain_events.sync_status
      END,
      server_sequence = COALESCE(excluded.server_sequence, domain_events.server_sequence)`,
    event.eventId,
    event.eventType,
    event.aggregateId,
    event.occurredAt,
    JSON.stringify(event.payload),
    event.syncStatus,
    event.serverSequence ?? null,
  );
}

function rowToCourse(row: CourseRow, times: CourseTimeRow[]): MedicationCourse {
  return {
    id: row.id,
    medicationId: row.medication_id,
    medicationName: row.medication_name,
    ...(row.strength ? { strength: row.strength } : {}),
    dose: row.dose,
    ...(row.food_relation ? { foodRelation: row.food_relation } : {}),
    startDay: row.start_day,
    endDay: row.end_day,
    isPaused: row.is_paused === 1,
    scheduledTimes: times
      .filter(({ course_id }) => course_id === row.id)
      .map(({ id, scheduled_minutes }) => ({
        id,
        scheduledMinutes: scheduled_minutes,
      }))
      .sort((left, right) => left.scheduledMinutes - right.scheduledMinutes),
    stockQuantity: row.stock_quantity,
    stockUnit: row.stock_unit,
    lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSqliteAppRepository(
  db: SQLiteDatabase,
  dependencies: AppRepositoryDependencies = {},
): AppRepository {
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  let writeQueue: Promise<void> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const queued = writeQueue.then(operation, operation);
    writeQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  async function listCourses(): Promise<MedicationCourse[]> {
    const [courses, times] = await Promise.all([
      db.getAllAsync<CourseRow>(
        `SELECT
          c.id, c.medication_id, m.name AS medication_name, m.strength,
          m.stock_quantity, m.stock_unit, m.low_stock_threshold,
          c.dose, c.food_relation, c.start_day, c.end_day, c.is_paused,
          c.created_at, c.updated_at
        FROM courses c
        JOIN medications m ON m.id = c.medication_id
        WHERE m.is_archived = 0
        ORDER BY m.name COLLATE NOCASE, c.created_at`,
      ),
      db.getAllAsync<CourseTimeRow>(
        `SELECT id, course_id, scheduled_minutes
         FROM course_times
         ORDER BY scheduled_minutes`,
      ),
    ]);
    return courses.map((course) => rowToCourse(course, times));
  }

  async function saveCourseInternal(course: MedicationCourse): Promise<void> {
    await db.withTransactionAsync(async () => {
      await writeCourseProjection(db, course);
      await insertDomainEvent(db, {
        eventId: createId(),
        eventType: 'course.saved',
        aggregateId: course.id,
        occurredAt: course.updatedAt,
        payload: asPayload(course),
        syncStatus: 'pending',
      });
    });
  }

  return {
    createCourse(input) {
      return enqueue(async () => {
        const normalized = normalizeCourseInput(input);
        const timestamp = now().toISOString();
        const course: MedicationCourse = {
          id: createId(),
          medicationId: createId(),
          medicationName: normalized.medicationName,
          ...(normalized.strength ? { strength: normalized.strength } : {}),
          dose: normalized.dose,
          ...(normalized.foodRelation
            ? { foodRelation: normalized.foodRelation }
            : {}),
          startDay: normalized.startDay,
          endDay: normalized.endDay,
          isPaused: false,
          scheduledTimes: normalized.scheduledMinutes.map((scheduledMinutes) => ({
            id: createId(),
            scheduledMinutes,
          })),
          stockQuantity: normalized.stockQuantity,
          stockUnit: normalized.stockUnit,
          lowStockThreshold: normalized.lowStockThreshold,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await saveCourseInternal(course);
        return course;
      });
    },

    updateCourse(courseId, input) {
      return enqueue(async () => {
        const existing = (await listCourses()).find(({ id }) => id === courseId);
        if (!existing) throw new Error('Курс не найден');
        const normalized = normalizeCourseInput(input);
        const previousTimes = new Map(
          existing.scheduledTimes.map((time) => [time.scheduledMinutes, time.id]),
        );
        const course: MedicationCourse = {
          ...existing,
          medicationName: normalized.medicationName,
          ...(normalized.strength
            ? { strength: normalized.strength }
            : { strength: undefined }),
          dose: normalized.dose,
          ...(normalized.foodRelation
            ? { foodRelation: normalized.foodRelation }
            : { foodRelation: undefined }),
          startDay: normalized.startDay,
          endDay: normalized.endDay,
          scheduledTimes: normalized.scheduledMinutes.map((scheduledMinutes) => ({
            id: previousTimes.get(scheduledMinutes) ?? createId(),
            scheduledMinutes,
          })),
          stockQuantity: normalized.stockQuantity,
          stockUnit: normalized.stockUnit,
          lowStockThreshold: normalized.lowStockThreshold,
          updatedAt: now().toISOString(),
        };
        await saveCourseInternal(course);
        return course;
      });
    },

    saveCourse(course) {
      return enqueue(() => saveCourseInternal(course));
    },

    setCoursePaused(courseId, isPaused) {
      return enqueue(async () => {
        const course = (await listCourses()).find(({ id }) => id === courseId);
        if (!course) throw new Error('Курс не найден');
        await saveCourseInternal({
          ...course,
          isPaused,
          updatedAt: now().toISOString(),
        });
      });
    },

    deleteCourse(courseId) {
      return enqueue(async () => {
        const timestamp = now().toISOString();
        await db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM courses WHERE id = ?', courseId);
          await insertDomainEvent(db, {
            eventId: createId(),
            eventType: 'course.deleted',
            aggregateId: courseId,
            occurredAt: timestamp,
            payload: { courseId },
            syncStatus: 'pending',
          });
        });
      });
    },

    listCourses,

    async loadMedicationEvents() {
      const rows = await db.getAllAsync<EventRow>(
        `SELECT event_id, event_type, aggregate_id, occurred_at, payload_json,
                sync_status, server_sequence
         FROM domain_events
         WHERE event_type LIKE 'intake.%'
         ORDER BY occurred_at, event_id`,
      );
      return rows.map(({ payload_json }) => parsePayload(payload_json) as unknown as MedicationEvent);
    },

    appendMedicationEvent(event) {
      return enqueue(async () => {
        let payload: MedicationEvent = event;
        if (event.type !== 'undone') {
          const course = (await listCourses()).find((candidate) =>
            candidate.scheduledTimes.some((time) => time.id === event.doseId),
          );
          if (course) {
            payload = {
              ...event,
              medicationName: course.medicationName,
              ...(course.strength ? { strength: course.strength } : {}),
              dose: course.dose,
            };
          }
        }
        await insertDomainEvent(db, {
          eventId: event.id,
          eventType: `intake.${event.type}`,
          aggregateId:
            event.type === 'undone' ? event.targetEventId : event.doseId,
          occurredAt: event.recordedAt,
          payload: asPayload(payload),
          syncStatus: 'pending',
        });
      });
    },

    async listPendingSyncEvents(limit = 200) {
      const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
      const rows = await db.getAllAsync<EventRow>(
        `SELECT event_id, event_type, aggregate_id, occurred_at, payload_json,
                sync_status, server_sequence
         FROM domain_events
         WHERE sync_status = 'pending'
         ORDER BY occurred_at, event_id
         LIMIT ?`,
        safeLimit,
      );
      return rows.map(
        (row): SyncEventRecord => ({
          eventId: row.event_id,
          eventType: row.event_type,
          aggregateId: row.aggregate_id,
          occurredAt: row.occurred_at,
          payload: parsePayload(row.payload_json),
          syncStatus: row.sync_status,
          serverSequence: row.server_sequence,
        }),
      );
    },

    markSyncEventsSynced(eventIds, serverSequence) {
      return enqueue(async () => {
        if (eventIds.length === 0) return;
        const placeholders = eventIds.map(() => '?').join(', ');
        await db.runAsync(
          `UPDATE domain_events
           SET sync_status = 'synced', server_sequence = ?
           WHERE event_id IN (${placeholders})`,
          serverSequence,
          ...eventIds,
        );
      });
    },

    applyRemoteEvents(events) {
      return enqueue(async () => {
        await db.withTransactionAsync(async () => {
          for (const event of events) {
            if (event.eventType === 'course.saved') {
              await writeCourseProjection(
                db,
                event.payload as unknown as MedicationCourse,
              );
            } else if (event.eventType === 'course.deleted') {
              await db.runAsync(
                'DELETE FROM courses WHERE id = ?',
                event.aggregateId,
              );
            }
            await insertDomainEvent(db, {
              ...event,
              syncStatus: 'synced',
            });
          }
        });
      });
    },

    async getSyncCursor() {
      const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_state WHERE key = 'server_cursor'`,
      );
      return row ? Number(row.value) : 0;
    },

    setSyncCursor(cursor) {
      return enqueue(async () => {
        await db.runAsync(
          `INSERT INTO sync_state (key, value) VALUES ('server_cursor', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          String(cursor),
        );
      });
    },
  };
}
