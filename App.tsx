import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { migrateDatabase } from './src/data/database';
import { createSqliteAppRepository } from './src/data/sqliteAppRepository';
import { poraApiBaseUrl } from './src/config';
import {
  projectPlanFromCourses,
  type MedicationCourse,
  type NewMedicationCourseInput,
} from './src/domain/medicationCourse';
import type { MedicationEvent } from './src/domain/medicationDay';
import { toLocalDayKey } from './src/domain/localDay';
import { HistoryScreen } from './src/features/history/HistoryScreen';
import { shareHistoryCsv } from './src/features/history/exportHistory';
import { AccountScreen, type SyncStatus } from './src/features/auth/AccountScreen';
import { AuthScreen, type AuthMode } from './src/features/auth/AuthScreen';
import { RecoveryCodeScreen } from './src/features/auth/RecoveryCodeScreen';
import { CatalogMedicationScreen } from './src/catalog/CatalogMedicationScreen';
import { CabinetScreen } from './src/features/medications/CabinetScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { TodayScreen } from './src/features/today/TodayScreen';
import { notificationResponseToAction } from './src/notifications/notificationActions';
import {
  getNotificationCapability,
  initializeNotificationSystem,
  Notifications,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  reconcileNotificationSchedule,
  requestNotificationPermission,
  scheduleSnoozeNotification,
  type MedicationNotificationData,
  type NotificationCapability,
} from './src/notifications/notificationService';
import { PoraApiClient, type AuthSession } from './src/sync/apiClient';
import { getOrCreateDeviceId } from './src/sync/deviceId';
import { SecureSessionStore } from './src/sync/secureSessionStore';
import { runSync } from './src/sync/syncEngine';
import { PoraIcon, type PoraIconName } from './src/ui/PoraIcon';
import { useStyles, useTheme, type Theme } from './src/ui/theme';

type Tab = 'today' | 'cabinet' | 'history';

const tabs: Array<{ id: Tab; icon: PoraIconName; label: string }> = [
  { id: 'today', icon: 'calendar-blank-outline', label: 'Сегодня' },
  { id: 'cabinet', icon: 'pill', label: 'Аптечка' },
  { id: 'history', icon: 'history', label: 'История' },
];

function LoadingScreen() {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingWordmark}>пора</Text>
      <ActivityIndicator color={theme.onHero} size="small" />
    </View>
  );
}

function BottomNavigation({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { bottom: Math.max(10, insets.bottom) }]}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.navItem,
              active && styles.navItemActive,
              pressed && styles.pressed,
            ]}
          >
            <PoraIcon
              color={active ? theme.primaryInk : theme.muted}
              name={tab.icon}
              size={24}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PoraApp() {
  const styles = useStyles(createStyles);
  const database = useSQLiteContext();
  const repository = useMemo(
    () => createSqliteAppRepository(database),
    [database],
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const sessionStore = useMemo(() => new SecureSessionStore(), []);
  const api = useMemo(
    () =>
      new PoraApiClient({
        baseUrl: poraApiBaseUrl,
        sessionStore,
        onSessionChanged: setSession,
      }),
    [sessionStore],
  );
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [activeScreen, setActiveScreen] = useState<
    'tabs' | 'course' | 'settings' | 'auth' | 'account' | 'recovery-code'
  >('tabs');
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [editingCourse, setEditingCourse] = useState<MedicationCourse>();
  const [courses, setCourses] = useState<MedicationCourse[]>([]);
  const [storedEvents, setStoredEvents] = useState<MedicationEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [notificationCapability, setNotificationCapability] =
    useState<NotificationCapability>({
      permission: 'not-determined',
      exactAlarmsAllowed: false,
      ignoringBatteryOptimizations: false,
    });
  const now = useMemo(() => new Date(), []);
  const plan = useMemo(
    () => projectPlanFromCourses(courses, toLocalDayKey(now)),
    [courses, now],
  );

  const reloadData = useCallback(async () => {
    const [nextCourses, nextEvents] = await Promise.all([
      repository.listCourses(),
      repository.loadMedicationEvents(),
    ]);
    setCourses(nextCourses);
    setStoredEvents(nextEvents);
  }, [repository]);

  useEffect(() => {
    let mounted = true;
    Promise.all([reloadData(), api.loadSession()])
      .catch(() => {
        if (mounted) setStorageError(true);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [api, reloadData]);

  const performSync = useCallback(async () => {
    if (!api.getSession()) {
      setSyncStatus('idle');
      return;
    }
    setSyncStatus('syncing');
    try {
      const deviceId = await getOrCreateDeviceId();
      await runSync(repository, api, deviceId);
      await reloadData();
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus(error instanceof TypeError ? 'offline' : 'error');
    }
  }, [api, reloadData, repository]);

  useEffect(() => {
    if (ready && session) void performSync();
  }, [performSync, ready, session]);

  const refreshNotificationSystem = useCallback(async () => {
    await initializeNotificationSystem();
    const capability = await getNotificationCapability();
    setNotificationCapability(capability);
    if (capability.permission === 'granted') {
      await reconcileNotificationSchedule(courses);
    }
  }, [courses]);

  useEffect(() => {
    if (!ready) return;
    void refreshNotificationSystem().catch(() => undefined);
  }, [ready, refreshNotificationSystem]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshNotificationSystem().catch(() => undefined);
        if (api.getSession()) void performSync();
      }
    });
    return () => subscription.remove();
  }, [api, performSync, refreshNotificationSystem]);

  const processNotificationResponse = useCallback(
    async (response: Parameters<typeof notificationResponseToAction>[0]) => {
      const action = notificationResponseToAction(response);
      if (!action) return;
      await repository.appendMedicationEvent(action.event);
      if (action.snooze) {
        await scheduleSnoozeNotification(
          action.snooze.identifier,
          action.snooze.data,
          action.snooze.body,
          action.snooze.date,
        );
      }
      await Notifications.dismissNotificationAsync(action.notificationIdentifier);
      await reloadData();
      setActiveTab('today');
      setActiveScreen('tabs');
    },
    [reloadData, repository],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void processNotificationResponse(response)
          .then(() => Notifications.clearLastNotificationResponse())
          .catch(() => setStorageError(true));
      },
    );
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      void processNotificationResponse(lastResponse)
        .then(() => Notifications.clearLastNotificationResponse())
        .catch(() => setStorageError(true));
    }
    return () => subscription.remove();
  }, [processNotificationResponse]);

  async function handleEvent(event: MedicationEvent) {
    try {
      await repository.appendMedicationEvent(event);
      setStoredEvents(await repository.loadMedicationEvents());
      if (event.type === 'postponed') {
        const course = courses.find((candidate) =>
          candidate.scheduledTimes.some((time) => time.id === event.doseId),
        );
        if (course) {
          const data: MedicationNotificationData = {
            source: 'pora-medication-reminder',
            courseId: course.id,
            doseId: event.doseId,
            scheduledMinutes:
              course.scheduledTimes.find((time) => time.id === event.doseId)
                ?.scheduledMinutes ?? 0,
            ...(event.dayKey ? { scheduledDayKey: event.dayKey } : {}),
          };
          await scheduleSnoozeNotification(
            `pora:manual-snooze:${event.id}`,
            data,
            [
              `${course.medicationName}${course.strength ? ` ${course.strength}` : ''}`,
              course.dose,
            ].join(' · '),
            new Date(Date.now() + event.minutes * 60 * 1000),
          );
        }
      }
      if (api.getSession()) void performSync();
    } catch {
      setStorageError(true);
    }
  }

  async function configureNotifications() {
    try {
      const capability = await requestNotificationPermission();
      setNotificationCapability(capability);
      if (capability.permission !== 'granted') {
        Alert.alert(
          'Уведомления отключены',
          'Откройте системные настройки «Пора» и разрешите уведомления.',
          [
            { text: 'Позже', style: 'cancel' },
            { text: 'Открыть настройки', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      await reconcileNotificationSchedule(courses);
      if (!capability.exactAlarmsAllowed) {
        Alert.alert(
          'Разрешите точные будильники',
          'Без этого Android может доставлять напоминания с задержкой.',
          [
            { text: 'Позже', style: 'cancel' },
            { text: 'Открыть настройку', onPress: openExactAlarmSettings },
          ],
        );
        return;
      }
      if (!capability.ignoringBatteryOptimizations && Platform.OS === 'android') {
        Alert.alert(
          'Напоминания настроены',
          'Для некоторых оболочек Android полезно разрешить «Пора» работу без ограничений батареи.',
          [
            { text: 'Готово', style: 'cancel' },
            {
              text: 'Настройки батареи',
              onPress: openBatteryOptimizationSettings,
            },
          ],
        );
        return;
      }
      Alert.alert('Напоминания настроены', 'Расписание сохранено на устройстве.');
    } catch {
      Alert.alert('Не удалось настроить напоминания', 'Попробуйте еще раз.');
    }
  }

  async function handleSaveCourse(input: NewMedicationCourseInput) {
    if (editingCourse) await repository.updateCourse(editingCourse.id, input);
    else await repository.createCourse(input);
    await reloadData();
    if (api.getSession()) void performSync();
    setActiveTab('today');
    setActiveScreen('tabs');
    setEditingCourse(undefined);
  }

  function openCourseEditor(course?: MedicationCourse) {
    setEditingCourse(course);
    setActiveScreen('course');
  }

  async function toggleCoursePause(course: MedicationCourse) {
    await repository.setCoursePaused(course.id, !course.isPaused);
    await reloadData();
    if (api.getSession()) void performSync();
  }

  async function changeCourseStock(course: MedicationCourse, quantity: number) {
    await repository.saveCourse({
      ...course,
      stockQuantity: quantity,
      updatedAt: new Date().toISOString(),
    });
    await reloadData();
    if (api.getSession()) void performSync();
  }

  function confirmDeleteCourse(course: MedicationCourse) {
    Alert.alert(
      `Удалить «${course.medicationName}»?`,
      'Курс исчезнет из расписания. Уже записанная история останется.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            repository
              .deleteCourse(course.id)
              .then(reloadData)
              .then(() => performSync())
              .catch(() => setStorageError(true));
          },
        },
      ],
    );
  }

  async function exportHistory() {
    try {
      await shareHistoryCsv(courses, storedEvents);
    } catch {
      Alert.alert('Не удалось экспортировать историю', 'Попробуйте еще раз.');
    }
  }

  async function submitAuth(
    mode: AuthMode,
    email: string,
    password: string,
    displayName?: string,
    suppliedRecoveryCode?: string,
  ) {
    if (mode === 'register') {
      const result = await api.register(email, password, displayName);
      setRecoveryCode(result.recoveryCode);
      setActiveScreen('recovery-code');
      return;
    }
    if (mode === 'recover') {
      if (!suppliedRecoveryCode) throw new Error('Введите recovery code');
      const result = await api.recover(email, suppliedRecoveryCode, password);
      setRecoveryCode(result.recoveryCode);
      setActiveScreen('recovery-code');
      return;
    }
    await api.login(email, password);
    setActiveScreen('account');
    await performSync();
  }

  async function logout() {
    await api.logout();
    setSyncStatus('idle');
    setActiveScreen('settings');
  }

  async function confirmDeleteAccount() {
    Alert.alert(
      'Удалить аккаунт и серверную копию?',
      'Это действие нельзя отменить. Локальные данные останутся на телефоне.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить аккаунт',
          style: 'destructive',
          onPress: () => {
            api
              .deleteAccount()
              .then(() => {
                setSyncStatus('idle');
                setActiveScreen('settings');
              })
              .catch(() =>
                Alert.alert('Не удалось удалить аккаунт', 'Попробуйте еще раз.'),
              );
          },
        },
      ],
    );
  }

  if (!ready) return <LoadingScreen />;

  if (activeScreen === 'auth') {
    return (
      <AuthScreen
        onCancel={() => setActiveScreen('settings')}
        onSubmit={submitAuth}
      />
    );
  }

  if (activeScreen === 'recovery-code' && recoveryCode) {
    return (
      <RecoveryCodeScreen
        code={recoveryCode}
        onDone={() => {
          setRecoveryCode(undefined);
          setActiveScreen('account');
          void performSync();
        }}
      />
    );
  }

  if (activeScreen === 'account' && session) {
    return (
      <AccountScreen
        onBack={() => setActiveScreen('settings')}
        onDelete={confirmDeleteAccount}
        onLogout={logout}
        onSync={performSync}
        syncStatus={syncStatus}
        user={session.user}
      />
    );
  }

  if (activeScreen === 'settings') {
    return (
      <SettingsScreen
        accountEmail={session?.user.email ?? null}
        notificationStatus={notificationCapability.permission}
        onBack={() => setActiveScreen('tabs')}
        onConfigureNotifications={configureNotifications}
        onExport={exportHistory}
        onOpenAccount={() => setActiveScreen(session ? 'account' : 'auth')}
        onOpenPrivacy={() => void Linking.openURL(`${poraApiBaseUrl}/legal/privacy`)}
        onOpenTerms={() => void Linking.openURL(`${poraApiBaseUrl}/legal/terms`)}
      />
    );
  }

  if (activeScreen === 'course') {
    return (
      <CatalogMedicationScreen
        course={editingCourse}
        onCancel={() => {
          setEditingCourse(undefined);
          setActiveScreen('tabs');
        }}
        onSave={handleSaveCourse}
      />
    );
  }

  return (
    <View style={styles.app}>
      {activeTab === 'today' ? (
        <TodayScreen
          plan={plan}
          initialEvents={storedEvents}
          onAddMedication={() => openCourseEditor()}
          onEvent={handleEvent}
          onOpenSettings={() => setActiveScreen('settings')}
        />
      ) : activeTab === 'cabinet' ? (
        <CabinetScreen
          courses={courses}
          onAdd={() => openCourseEditor()}
          onChangeStock={changeCourseStock}
          onDelete={confirmDeleteCourse}
          onEdit={openCourseEditor}
          onTogglePause={toggleCoursePause}
        />
      ) : (
        <HistoryScreen
          courses={courses}
          events={storedEvents}
          onExport={exportHistory}
        />
      )}

      {storageError ? (
        <View style={styles.storageWarning}>
          <Text style={styles.storageWarningText}>
            Не удалось сохранить последнее действие
          </Text>
        </View>
      ) : null}

      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

export default function App() {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <SQLiteProvider databaseName="pora.db" onInit={migrateDatabase}>
            <PoraApp />
          </SQLiteProvider>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const createStyles = (theme: Theme) => ({
  root: {
    flex: 1,
    alignItems: 'center' as const,
    backgroundColor: theme.surfaceAlt,
  },
  safeArea: {
    flex: 1,
    width: '100%' as const,
    maxWidth: 430,
    backgroundColor: theme.bg,
  },
  app: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 18,
    backgroundColor: theme.hero,
  },
  loadingWordmark: {
    color: theme.onHero,
    fontSize: 44,
    fontWeight: '800' as const,
    letterSpacing: -2.4,
  },
  nav: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    height: 72,
    borderRadius: 36,
    padding: 6,
    flexDirection: 'row' as const,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.floating,
    boxShadow: `0 10px 24px ${theme.shadow}`,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    borderRadius: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
  },
  navItemActive: {
    backgroundColor: theme.primarySoft,
  },
  navLabel: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700' as const,
  },
  navLabelActive: {
    color: theme.primaryInk,
  },
  storageWarning: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 104,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.danger,
  },
  storageWarningText: {
    color: theme.scheme === 'dark' ? '#2A0E0A' : '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
