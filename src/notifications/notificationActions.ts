import type { MedicationEvent } from '../domain/medicationDay';
import { toLocalDayKey } from '../domain/localDay';
import {
  notificationActionPostponed,
  notificationActionSkipped,
  notificationActionTaken,
} from './notificationConstants';
import type { MedicationNotificationData } from './notificationService';

interface NotificationResponseLike {
  actionIdentifier: string;
  notification: {
    date: number;
    request: {
      identifier: string;
      content: {
        body?: string | null;
        data?: Record<string, unknown>;
      };
    };
  };
}

export interface MedicationNotificationAction {
  notificationIdentifier: string;
  event: MedicationEvent;
  snooze?: {
    identifier: string;
    data: MedicationNotificationData;
    body: string;
    date: Date;
  };
}

function readMedicationData(
  value: Record<string, unknown> | undefined,
): MedicationNotificationData | null {
  if (
    value?.source !== 'pora-medication-reminder' ||
    typeof value.courseId !== 'string' ||
    typeof value.doseId !== 'string' ||
    typeof value.scheduledMinutes !== 'number'
  ) {
    return null;
  }
  return {
    source: 'pora-medication-reminder',
    courseId: value.courseId,
    doseId: value.doseId,
    scheduledMinutes: value.scheduledMinutes,
    ...(typeof value.scheduledDayKey === 'string'
      ? { scheduledDayKey: value.scheduledDayKey }
      : {}),
  };
}

export function notificationResponseToAction(
  response: NotificationResponseLike,
  now = new Date(),
): MedicationNotificationAction | null {
  const { actionIdentifier } = response;
  if (
    actionIdentifier !== notificationActionTaken &&
    actionIdentifier !== notificationActionPostponed &&
    actionIdentifier !== notificationActionSkipped
  ) {
    return null;
  }

  const { request } = response.notification;
  const data = readMedicationData(request.content.data);
  if (!data) return null;

  const deliveredAt = new Date(response.notification.date);
  const dayKey =
    data.scheduledDayKey ??
    (Number.isNaN(deliveredAt.getTime())
      ? toLocalDayKey(now)
      : toLocalDayKey(deliveredAt));
  const base = {
    id: `notification:${request.identifier}:${actionIdentifier}`,
    doseId: data.doseId,
    dayKey,
    recordedAt: now.toISOString(),
  };

  if (actionIdentifier === notificationActionTaken) {
    return {
      notificationIdentifier: request.identifier,
      event: { ...base, type: 'taken' },
    };
  }
  if (actionIdentifier === notificationActionSkipped) {
    return {
      notificationIdentifier: request.identifier,
      event: { ...base, type: 'skipped' },
    };
  }

  const date = new Date(now.getTime() + 10 * 60 * 1000);
  return {
    notificationIdentifier: request.identifier,
    event: {
      ...base,
      type: 'postponed',
      minutes: 10,
    },
    snooze: {
      identifier: `${request.identifier}:snooze:10`,
      data,
      body: request.content.body ?? 'Лекарство из вашего расписания',
      date,
    },
  };
}
