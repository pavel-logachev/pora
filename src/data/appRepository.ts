import type { MedicationCourse, NewMedicationCourseInput } from '../domain/medicationCourse';
import type { MedicationEvent } from '../domain/medicationDay';

export interface SyncEventRecord {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  syncStatus: 'pending' | 'synced';
  serverSequence: number | null;
}

export interface RemoteSyncEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  serverSequence: number;
}

export interface AppRepository {
  createCourse(input: NewMedicationCourseInput): Promise<MedicationCourse>;
  updateCourse(
    courseId: string,
    input: NewMedicationCourseInput,
  ): Promise<MedicationCourse>;
  saveCourse(course: MedicationCourse): Promise<void>;
  setCoursePaused(courseId: string, isPaused: boolean): Promise<void>;
  deleteCourse(courseId: string): Promise<void>;
  listCourses(): Promise<MedicationCourse[]>;
  loadMedicationEvents(): Promise<MedicationEvent[]>;
  appendMedicationEvent(event: MedicationEvent): Promise<void>;
  listPendingSyncEvents(limit?: number): Promise<SyncEventRecord[]>;
  markSyncEventsSynced(eventIds: string[], serverSequence: number): Promise<void>;
  applyRemoteEvents(events: RemoteSyncEvent[]): Promise<void>;
  getSyncCursor(): Promise<number>;
  setSyncCursor(cursor: number): Promise<void>;
}
