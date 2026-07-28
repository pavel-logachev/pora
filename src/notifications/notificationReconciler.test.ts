import type { MedicationCourse } from '../domain/medicationCourse';
import {
  reconcileMedicationNotifications,
  type NotificationSchedulerAdapter,
} from './notificationReconciler';

const activeCourse: MedicationCourse = {
  id: 'course-1',
  medicationId: 'med-1',
  medicationName: 'Телмисартан',
  strength: '40 мг',
  dose: '1 таблетка',
  startDay: '2026-07-01',
  endDay: null,
  isPaused: false,
  scheduledTimes: [{ id: 'time-9', scheduledMinutes: 540 }],
  stockQuantity: null,
  stockUnit: null,
  lowStockThreshold: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('notification reconciliation', () => {
  it('replaces only Pora jobs and preserves other app notifications', async () => {
    const cancelled: string[] = [];
    const scheduled: string[] = [];
    const adapter: NotificationSchedulerAdapter = {
      getScheduled: async () => [
        { identifier: 'old-pora', source: 'pora-medication-reminder' },
        { identifier: 'foreign', source: 'another-feature' },
      ],
      cancel: async (identifier) => {
        cancelled.push(identifier);
      },
      schedule: async (job) => {
        scheduled.push(job.id);
      },
    };

    const count = await reconcileMedicationNotifications(
      adapter,
      [activeCourse],
      new Date(2026, 6, 28, 12, 0, 0),
    );

    expect(cancelled).toEqual(['old-pora']);
    expect(scheduled).toEqual(['pora:course-1:time-9:daily']);
    expect(count).toBe(1);
  });
});
