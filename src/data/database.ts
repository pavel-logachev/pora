import type { SQLiteDatabase } from 'expo-sqlite';

const schemaVersion = 1;

const migrationV1 = `
CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  strength TEXT,
  form TEXT,
  stock_quantity REAL,
  stock_unit TEXT,
  low_stock_threshold REAL,
  notes TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY NOT NULL,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  dose TEXT NOT NULL,
  food_relation TEXT,
  start_day TEXT NOT NULL,
  end_day TEXT,
  is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_times (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  scheduled_minutes INTEGER NOT NULL CHECK (scheduled_minutes BETWEEN 0 AND 1439),
  UNIQUE (course_id, scheduled_minutes)
);

CREATE TABLE IF NOT EXISTS domain_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced')),
  server_sequence INTEGER
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  occurrence_id TEXT PRIMARY KEY NOT NULL,
  notification_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_medication ON courses(medication_id);
CREATE INDEX IF NOT EXISTS idx_course_times_course ON course_times(course_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_occurred ON domain_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_pending ON domain_events(sync_status, occurred_at);
`;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // journal_mode cannot be changed inside the schema transaction on Android.
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > schemaVersion) {
    throw new Error(
      `База данных создана более новой версией приложения (${currentVersion})`,
    );
  }

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV1);
      await db.execAsync('PRAGMA user_version = 1');
    });
  }
}
