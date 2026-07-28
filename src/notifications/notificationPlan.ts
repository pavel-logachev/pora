import type { MedicationCourse } from '../domain/medicationCourse';
import { toLocalDayKey } from '../domain/localDay';

export type NotificationTriggerPlan =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'date'; date: Date };

export interface MedicationNotificationJob {
  id: string;
  courseId: string;
  doseId: string;
  scheduledMinutes: number;
  scheduledDayKey?: string;
  title: string;
  body: string;
  trigger: NotificationTriggerPlan;
}

const defaultHorizonDays = 60;

function localDate(dayKey: string, scheduledMinutes = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new Error(`Некорректная дата курса: ${dayKey}`);
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Math.floor(scheduledMinutes / 60),
    scheduledMinutes % 60,
    0,
    0,
  );
}

function laterDay(left: string, right: string) {
  return left > right ? left : right;
}

function earlierDay(left: string, right: string) {
  return left < right ? left : right;
}

function addDays(dayKey: string, days: number) {
  const date = localDate(dayKey);
  date.setDate(date.getDate() + days);
  return toLocalDayKey(date);
}

function notificationBody(course: MedicationCourse) {
  return [
    `${course.medicationName}${course.strength ? ` ${course.strength}` : ''}`,
    course.dose,
  ].join(' · ');
}

export function buildNotificationPlan(
  courses: MedicationCourse[],
  now = new Date(),
  horizonDays = defaultHorizonDays,
): MedicationNotificationJob[] {
  const today = toLocalDayKey(now);
  const horizonDay = addDays(today, horizonDays);
  const jobs: MedicationNotificationJob[] = [];

  for (const course of courses) {
    if (course.isPaused || (course.endDay && course.endDay < today)) continue;

    const times = [...course.scheduledTimes].sort(
      (left, right) => left.scheduledMinutes - right.scheduledMinutes,
    );

    if (course.startDay <= today && course.endDay === null) {
      for (const time of times) {
        jobs.push({
          id: `pora:${course.id}:${time.id}:daily`,
          courseId: course.id,
          doseId: time.id,
          scheduledMinutes: time.scheduledMinutes,
          title: 'Пора принять лекарство',
          body: notificationBody(course),
          trigger: {
            kind: 'daily',
            hour: Math.floor(time.scheduledMinutes / 60),
            minute: time.scheduledMinutes % 60,
          },
        });
      }
      continue;
    }

    const firstDay = laterDay(course.startDay, today);
    const lastDay = course.endDay
      ? earlierDay(course.endDay, horizonDay)
      : horizonDay;
    if (firstDay > lastDay) continue;

    for (
      let dayKey = firstDay;
      dayKey <= lastDay;
      dayKey = addDays(dayKey, 1)
    ) {
      for (const time of times) {
        const date = localDate(dayKey, time.scheduledMinutes);
        if (date.getTime() <= now.getTime()) continue;
        jobs.push({
          id: `pora:${course.id}:${time.id}:${dayKey}`,
          courseId: course.id,
          doseId: time.id,
          scheduledMinutes: time.scheduledMinutes,
          scheduledDayKey: dayKey,
          title: 'Пора принять лекарство',
          body: notificationBody(course),
          trigger: { kind: 'date', date },
        });
      }
    }
  }

  return jobs;
}
