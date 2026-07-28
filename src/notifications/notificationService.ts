import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import PoraDeviceSettings from '../../modules/pora-device-settings/src/PoraDeviceSettingsModule';
import type { MedicationCourse } from '../domain/medicationCourse';
import {
  medicationNotificationCategory,
  medicationNotificationChannel,
  notificationActionPostponed,
  notificationActionSkipped,
  notificationActionTaken,
} from './notificationConstants';
import type { MedicationNotificationJob } from './notificationPlan';
import {
  reconcileMedicationNotifications,
  type NotificationSchedulerAdapter,
} from './notificationReconciler';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'not-determined';

export interface NotificationCapability {
  permission: NotificationPermissionState;
  exactAlarmsAllowed: boolean;
  ignoringBatteryOptimizations: boolean;
}

export interface MedicationNotificationData extends Record<string, unknown> {
  source: 'pora-medication-reminder';
  courseId: string;
  doseId: string;
  scheduledMinutes: number;
  scheduledDayKey?: string;
}

function permissionState(status: string): NotificationPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'not-determined';
}

function contentData(job: MedicationNotificationJob): MedicationNotificationData {
  return {
    source: 'pora-medication-reminder',
    courseId: job.courseId,
    doseId: job.doseId,
    scheduledMinutes: job.scheduledMinutes,
    ...(job.scheduledDayKey ? { scheduledDayKey: job.scheduledDayKey } : {}),
  };
}

const expoNotificationAdapter: NotificationSchedulerAdapter = {
  async getScheduled() {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications.map((request) => ({
      identifier: request.identifier,
      source:
        typeof request.content.data?.source === 'string'
          ? request.content.data.source
          : undefined,
    }));
  },
  async cancel(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
  async schedule(job) {
    const trigger: Notifications.NotificationTriggerInput =
      job.trigger.kind === 'daily'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: job.trigger.hour,
            minute: job.trigger.minute,
            channelId: medicationNotificationChannel,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: job.trigger.date,
            channelId: medicationNotificationChannel,
          };
    await Notifications.scheduleNotificationAsync({
      identifier: job.id,
      content: {
        title: job.title,
        body: job.body,
        data: contentData(job),
        sound: 'default',
        color: '#4658D9',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: medicationNotificationCategory,
      },
      trigger,
    });
  },
};

export async function initializeNotificationSystem() {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      medicationNotificationChannel,
      {
        name: 'Прием лекарств',
        description: 'Напоминания по вашему локальному расписанию',
        importance: Notifications.AndroidImportance.MAX,
        enableVibrate: true,
        vibrationPattern: [0, 250, 180, 250],
        lightColor: '#4658D9',
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        sound: 'default',
      },
    );
  }

  await Notifications.setNotificationCategoryAsync(
    medicationNotificationCategory,
    [
      {
        identifier: notificationActionTaken,
        buttonTitle: 'Принял',
        options: { opensAppToForeground: true },
      },
      {
        identifier: notificationActionPostponed,
        buttonTitle: '+10 мин',
        options: { opensAppToForeground: true },
      },
      {
        identifier: notificationActionSkipped,
        buttonTitle: 'Пропустить',
        options: { opensAppToForeground: true },
      },
    ],
    { previewPlaceholder: 'Напоминание «Пора»' },
  );
}

export async function getNotificationCapability(): Promise<NotificationCapability> {
  if (Platform.OS === 'web') {
    return {
      permission: 'granted',
      exactAlarmsAllowed: true,
      ignoringBatteryOptimizations: true,
    };
  }
  const permission = await Notifications.getPermissionsAsync();
  return {
    permission: permissionState(permission.status),
    exactAlarmsAllowed:
      Platform.OS !== 'android' || PoraDeviceSettings.canScheduleExactAlarms(),
    ignoringBatteryOptimizations:
      Platform.OS !== 'android' ||
      PoraDeviceSettings.isIgnoringBatteryOptimizations(),
  };
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return getNotificationCapability();
  await initializeNotificationSystem();
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
  }
  return getNotificationCapability();
}

export async function reconcileNotificationSchedule(
  courses: MedicationCourse[],
  now = new Date(),
) {
  if (Platform.OS === 'web') return 0;
  await initializeNotificationSystem();
  const capability = await getNotificationCapability();
  if (capability.permission !== 'granted') return 0;
  return reconcileMedicationNotifications(expoNotificationAdapter, courses, now);
}

export async function scheduleSnoozeNotification(
  identifier: string,
  data: MedicationNotificationData,
  body: string,
  date = new Date(Date.now() + 10 * 60 * 1000),
) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Пора вернуться к приему',
      body,
      data,
      sound: 'default',
      color: '#4658D9',
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: medicationNotificationCategory,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: medicationNotificationChannel,
    },
  });
}

export function openExactAlarmSettings() {
  if (Platform.OS === 'android') PoraDeviceSettings.openExactAlarmSettings();
}

export function openBatteryOptimizationSettings() {
  if (Platform.OS === 'android') {
    PoraDeviceSettings.openBatteryOptimizationSettings();
  }
}

export { Notifications };
