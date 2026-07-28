import { buildNotificationPlan } from './notificationPlan';
import type { MedicationCourse } from '../domain/medicationCourse';

function course(
  overrides: Partial<MedicationCourse> = {},
): MedicationCourse {
  return {
    id: 'course-1',
    medicationId: 'med-1',
    medicationName: 'Телмисартан',
    strength: '40 мг',
    dose: '1 таблетка',
    startDay: '2026-07-01',
    endDay: null,
    isPaused: false,
    scheduledTimes: [
      { id: 'time-9', scheduledMinutes: 9 * 60 },
      { id: 'time-21', scheduledMinutes: 21 * 60 },
    ],
    stockQuantity: 28,
    stockUnit: 'таблеток',
    lowStockThreshold: 5,
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('notification plan', () => {
  it('uses recurring local-time alarms for an active ongoing course', () => {
    const jobs = buildNotificationPlan(
      [course()],
      new Date(2026, 6, 28, 12, 0, 0),
    );

    expect(jobs.map((job) => job.trigger)).toEqual([
      { kind: 'daily', hour: 9, minute: 0 },
      { kind: 'daily', hour: 21, minute: 0 },
    ]);
    expect(jobs[0]).toMatchObject({
      id: 'pora:course-1:time-9:daily',
      doseId: 'time-9',
      title: 'Пора принять лекарство',
    });
  });

  it('uses dated alarms for a finite course and does not schedule past doses', () => {
    const jobs = buildNotificationPlan(
      [
        course({
          startDay: '2026-07-28',
          endDay: '2026-07-29',
          scheduledTimes: [{ id: 'time-9', scheduledMinutes: 9 * 60 }],
        }),
      ],
      new Date(2026, 6, 28, 12, 0, 0),
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe('pora:course-1:time-9:2026-07-29');
    expect(jobs[0]?.trigger.kind).toBe('date');
    if (jobs[0]?.trigger.kind === 'date') {
      expect(jobs[0].trigger.date).toEqual(new Date(2026, 6, 29, 9, 0, 0));
    }
  });

  it('omits paused and already completed courses', () => {
    const jobs = buildNotificationPlan(
      [
        course({ id: 'paused', isPaused: true }),
        course({ id: 'ended', endDay: '2026-07-20' }),
      ],
      new Date(2026, 6, 28, 12, 0, 0),
    );

    expect(jobs).toEqual([]);
  });
});
