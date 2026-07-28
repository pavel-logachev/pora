import type { MedicationCourse } from '../domain/medicationCourse';
import {
  buildNotificationPlan,
  type MedicationNotificationJob,
} from './notificationPlan';

export interface ScheduledNotificationSummary {
  identifier: string;
  source?: string;
}

export interface NotificationSchedulerAdapter {
  getScheduled(): Promise<ScheduledNotificationSummary[]>;
  cancel(identifier: string): Promise<void>;
  schedule(job: MedicationNotificationJob): Promise<void>;
}

export async function reconcileMedicationNotifications(
  adapter: NotificationSchedulerAdapter,
  courses: MedicationCourse[],
  now = new Date(),
) {
  const scheduled = await adapter.getScheduled();
  const managed = scheduled.filter(
    (notification) => notification.source === 'pora-medication-reminder',
  );
  await Promise.all(
    managed.map((notification) => adapter.cancel(notification.identifier)),
  );

  const plan = buildNotificationPlan(courses, now);
  for (const job of plan) await adapter.schedule(job);
  return plan.length;
}
