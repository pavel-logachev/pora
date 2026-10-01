import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  projectMedicationDay,
  type MedicationEvent,
  type MedicationPlanItem,
} from '../../domain/medicationDay';
import { buildWeekView, toLocalDayKey } from '../../domain/localDay';
import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export interface TodayScreenProps {
  plan: MedicationPlanItem[];
  initialEvents?: MedicationEvent[];
  createEventId?: () => string;
  now?: () => Date;
  onEvent?: (event: MedicationEvent) => void | Promise<void>;
  onAddMedication?: () => void;
  onOpenSettings?: () => void;
}

function defaultEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatMinutes(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function displayMedication(item: MedicationPlanItem) {
  // A non-breaking space keeps "200 мг" together when a long title has to wrap.
  return [item.medicationName, item.strength?.replace(/ /g, '\u00a0')]
    .filter(Boolean)
    .join(' ');
}

function describeDoseTiming(
  dose: MedicationPlanItem & { displayMinutes: number; status: string },
  currentMinutes: number,
) {
  if (currentMinutes > dose.displayMinutes + 30) {
    return `Просрочено · ${formatMinutes(dose.displayMinutes)}`;
  }
  if (dose.status === 'postponed') {
    return `Перенесено · ${formatMinutes(dose.displayMinutes)}`;
  }
  if (currentMinutes < dose.displayMinutes - 30) {
    return `Далее · ${formatMinutes(dose.displayMinutes)}`;
  }
  return `Сейчас · до ${formatMinutes(dose.displayMinutes + 30)}`;
}

export function TodayScreen({
  plan,
  initialEvents = [],
  createEventId = defaultEventId,
  now = () => new Date(),
  onEvent,
  onAddMedication,
  onOpenSettings,
}: TodayScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const { height: viewportHeight } = useWindowDimensions();
  const compact = viewportHeight < 700;
  const [events, setEvents] = useState(initialEvents);
  const [lastActionId, setLastActionId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const currentDate = now();
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const dayKey = toLocalDayKey(currentDate);
  const weekView = buildWeekView(currentDate);
  const day = useMemo(
    () => projectMedicationDay(plan, events, dayKey),
    [dayKey, events, plan],
  );
  const nextDose = day.nextDose;
  const nextDoseOverdue = Boolean(
    nextDose && currentMinutes > nextDose.displayMinutes + 30,
  );

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  function appendEvent(event: MedicationEvent) {
    setEvents((current) => [...current, event]);
    void onEvent?.(event);
  }

  function takeCurrentDose() {
    if (!nextDose) return;
    const event: MedicationEvent = {
      id: createEventId(),
      type: 'taken',
      doseId: nextDose.id,
      dayKey,
      recordedAt: now().toISOString(),
    };
    appendEvent(event);
    setLastActionId(event.id);
    setNotice('Прием отмечен');
  }

  function postponeCurrentDose() {
    if (!nextDose) return;
    const event: MedicationEvent = {
      id: createEventId(),
      type: 'postponed',
      doseId: nextDose.id,
      dayKey,
      recordedAt: now().toISOString(),
      minutes: 10,
    };
    appendEvent(event);
    setLastActionId(event.id);
    setNotice('Перенесено на 10 минут');
  }

  function skipCurrentDose() {
    if (!nextDose) return;
    const event: MedicationEvent = {
      id: createEventId(),
      type: 'skipped',
      doseId: nextDose.id,
      dayKey,
      recordedAt: now().toISOString(),
    };
    appendEvent(event);
    setLastActionId(event.id);
    setNotice('Прием пропущен');
  }

  function undoLastAction() {
    if (!lastActionId) return;
    const event: MedicationEvent = {
      id: createEventId(),
      type: 'undone',
      targetEventId: lastActionId,
      dayKey,
      recordedAt: now().toISOString(),
    };
    appendEvent(event);
    setLastActionId(undefined);
    setNotice(undefined);
  }

  const progress = day.doses.length > 0 ? day.completedCount / day.doses.length : 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, compact && styles.headerCompact]}>
          <Text style={styles.wordmark}>пора</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Добавить лекарство"
              accessibilityRole="button"
              accessibilityState={{ disabled: !onAddMedication }}
              disabled={!onAddMedication}
              onPress={onAddMedication}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <PoraIcon color={theme.ink} name="plus" size={25} />
            </Pressable>
            <Pressable
              accessibilityLabel="Профиль и настройки"
              accessibilityRole="button"
              accessibilityState={{ disabled: !onOpenSettings }}
              disabled={!onOpenSettings}
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <PoraIcon color={theme.ink} name="cog-outline" size={23} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.weekLabel}>{weekView.label}</Text>
        <View style={styles.weekStrip}>
          {weekView.days.map((weekDay) => {
            const active = weekDay.isToday;
            return (
              <View
                key={weekDay.dayKey}
                style={[styles.dayCell, active && styles.dayCellActive]}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                  {weekDay.weekday}
                </Text>
                <Text style={[styles.dayDate, active && styles.dayDateActive]}>
                  {weekDay.date}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroRingLarge} />
          <View style={styles.heroRingSmall} />

          {nextDose ? (
            <>
              <View style={styles.kickerRow}>
                <View style={[styles.liveDot, nextDoseOverdue && styles.overdueDot]} />
                <Text style={styles.kickerText}>
                  {describeDoseTiming(nextDose, currentMinutes)}
                </Text>
              </View>
              <Text style={[styles.doseTitle, compact && styles.doseTitleCompact]}>
                {displayMedication(nextDose)}
              </Text>
              <Text style={styles.doseMeta}>
                {[nextDose.dose, nextDose.foodRelation].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel="Отметить прием"
                  accessibilityRole="button"
                  onPress={takeCurrentDose}
                  style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
                >
                  <View style={styles.checkBox}>
                    <PoraIcon color={theme.onHero} name="check" size={16} />
                  </View>
                  <Text style={styles.confirmText}>Отметить прием</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Отложить на 10 минут"
                  accessibilityRole="button"
                  onPress={postponeCurrentDose}
                  style={({ pressed }) => [styles.postponeButton, pressed && styles.pressed]}
                >
                  <Text style={styles.postponeText}>+10 мин</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel="Пропустить этот прием"
                accessibilityRole="button"
                hitSlop={8}
                onPress={skipCurrentDose}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
              >
                <Text style={styles.skipText}>Пропустить этот прием</Text>
              </Pressable>
            </>
          ) : plan.length === 0 ? (
            <View style={styles.emptyHero}>
              <Text style={styles.emptyTitle}>Добавьте первое лекарство</Text>
              <Text style={styles.emptyText}>
                Укажите назначенное время — «Пора» сохранит курс на телефоне и подготовит напоминания.
              </Text>
              <Pressable
                accessibilityLabel="Добавить первое лекарство"
                accessibilityRole="button"
                onPress={onAddMedication}
                style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              >
                <View style={styles.emptyButtonContent}>
                  <PoraIcon color={theme.hero} name="plus" size={20} />
                  <Text style={styles.emptyButtonText}>Добавить лекарство</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <View style={styles.finishedBlock}>
              <View style={styles.finishedIcon}>
                <PoraIcon color={theme.hero} name="check" size={24} />
              </View>
              <Text style={styles.finishedTitle}>На сегодня все</Text>
              <Text style={styles.doseMeta}>Все приемы отмечены</Text>
            </View>
          )}
        </View>

        <View style={[styles.daySection, compact && styles.daySectionCompact]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Сегодня</Text>
            {day.doses.length > 0 ? (
              <Text style={styles.sectionCount}>
                {day.completedCount} из {day.doses.length} принято
                {day.skippedCount > 0 ? ` · ${day.skippedCount} пропущено` : ''}
              </Text>
            ) : null}
          </View>
          {day.doses.length > 0 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.progressTrack}
            >
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}
          {day.doses.length === 0 ? (
            <View style={styles.emptyDayCard}>
              <Text style={styles.emptyDayText}>Расписание пока пустое</Text>
            </View>
          ) : null}
          {day.doses.length > 0 ? (
            <View style={styles.doseList}>
              {day.doses.map((dose, index) => {
                const taken = dose.status === 'taken';
                const skipped = dose.status === 'skipped';
                const upcoming = dose.status === 'upcoming';
                const postponed = dose.status === 'postponed';
                const overdue =
                  dose.id === nextDose?.id && currentMinutes > dose.displayMinutes + 30;
                const later =
                  dose.id === nextDose?.id && currentMinutes < dose.displayMinutes - 30;
                return (
                  <View
                    key={dose.id}
                    style={[
                      styles.doseRow,
                      compact && styles.doseRowCompact,
                      index > 0 && styles.doseRowBorder,
                    ]}
                  >
                    <View
                      style={[
                        styles.timeTile,
                        taken && styles.timeTileTaken,
                        skipped && styles.timeTileSkipped,
                        (upcoming || later) && styles.timeTileUpcoming,
                        overdue && styles.timeTileOverdue,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeText,
                          taken && styles.timeTextTaken,
                          skipped && styles.timeTextSkipped,
                          (upcoming || later) && styles.timeTextUpcoming,
                          overdue && styles.timeTextOverdue,
                        ]}
                      >
                        {formatMinutes(dose.displayMinutes)}
                      </Text>
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowName}>{dose.medicationName}</Text>
                      <Text style={styles.rowMeta}>
                        {[dose.strength, dose.dose].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowStatus,
                        taken && styles.rowStatusTaken,
                        skipped && styles.rowStatusSkipped,
                        (upcoming || later) && styles.rowStatusUpcoming,
                        overdue && styles.rowStatusOverdue,
                      ]}
                    >
                      {taken
                        ? 'Принято'
                        : skipped
                          ? 'Пропущено'
                          : overdue
                            ? 'Просрочено'
                            : postponed
                              ? 'Отложено'
                              : upcoming || later
                                ? 'Позже'
                                : 'Сейчас'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {notice && lastActionId ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable
            accessibilityLabel="Отменить последнее действие"
            accessibilityRole="button"
            onPress={undoLastAction}
            style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}
          >
            <Text style={styles.undoText}>Отменить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 124,
  },
  header: {
    height: 60,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  headerCompact: {
    height: 52,
  },
  wordmark: {
    color: theme.primaryInk,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -1.6,
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  weekLabel: {
    marginTop: 2,
    marginBottom: 10,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  weekStrip: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 16,
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    height: 62,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  dayCellActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  dayLabel: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600' as const,
  },
  dayLabelActive: {
    color: theme.onPrimary,
  },
  dayDate: {
    color: theme.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800' as const,
  },
  dayDateActive: {
    color: theme.onPrimary,
  },
  hero: {
    minHeight: 244,
    backgroundColor: theme.hero,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: radius.xl,
    overflow: 'hidden' as const,
    boxShadow: `0 14px 28px ${theme.shadow}`,
  },
  heroCompact: {
    minHeight: 220,
    paddingTop: 18,
    paddingBottom: 14,
  },
  heroRingLarge: {
    position: 'absolute' as const,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: theme.heroLine,
    right: -86,
    top: -70,
  },
  heroRingSmall: {
    position: 'absolute' as const,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: theme.heroLine,
    right: -44,
    top: -26,
  },
  kickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.heroLine,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F2C46D',
  },
  overdueDot: {
    backgroundColor: '#FF8D7C',
  },
  kickerText: {
    color: theme.onHero,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700' as const,
  },
  doseTitle: {
    marginTop: 16,
    marginBottom: 4,
    color: theme.onHero,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  doseTitleCompact: {
    marginTop: 12,
    fontSize: 28,
    lineHeight: 33,
  },
  doseMeta: {
    color: theme.onHeroMuted,
    fontSize: 16,
    lineHeight: 22,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row' as const,
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: 20,
    backgroundColor: theme.onHero,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.hero,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  confirmText: {
    color: theme.hero,
    fontSize: 17,
    fontWeight: '800' as const,
  },
  postponeButton: {
    width: 88,
    height: 56,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.heroLine,
  },
  postponeText: {
    color: theme.onHero,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  skipButton: {
    alignSelf: 'center' as const,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  skipText: {
    color: theme.onHeroMuted,
    fontSize: 14,
    fontWeight: '600' as const,
    textDecorationLine: 'underline' as const,
  },
  emptyHero: {
    flex: 1,
    justifyContent: 'flex-start' as const,
  },
  emptyTitle: {
    maxWidth: 300,
    color: theme.onHero,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800' as const,
    letterSpacing: -0.9,
    marginBottom: 8,
  },
  emptyText: {
    maxWidth: 320,
    color: theme.onHeroMuted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  emptyButton: {
    height: 56,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.onHero,
  },
  emptyButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  emptyButtonText: {
    color: theme.hero,
    fontSize: 17,
    fontWeight: '800' as const,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  finishedBlock: {
    minHeight: 150,
    justifyContent: 'flex-end' as const,
  },
  finishedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.onHero,
    marginBottom: 14,
  },
  finishedTitle: {
    color: theme.onHero,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  daySection: {
    paddingTop: 24,
  },
  daySectionCompact: {
    paddingTop: 18,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
  },
  sectionTitle: {
    color: theme.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800' as const,
  },
  sectionCount: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.line,
    overflow: 'hidden' as const,
    marginBottom: 14,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.success,
  },
  doseList: {
    overflow: 'hidden' as const,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  emptyDayCard: {
    minHeight: 68,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyDayText: {
    color: theme.muted,
    fontSize: 14,
  },
  doseRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  doseRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  doseRowCompact: {
    minHeight: 64,
    paddingVertical: 8,
  },
  timeTile: {
    minWidth: 56,
    height: 46,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: theme.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timeTileTaken: {
    backgroundColor: theme.successSoft,
  },
  timeTileSkipped: {
    backgroundColor: theme.surfaceAlt,
  },
  timeTileUpcoming: {
    backgroundColor: theme.warningSoft,
  },
  timeTileOverdue: {
    backgroundColor: theme.dangerSoft,
  },
  timeText: {
    color: theme.primaryInk,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  timeTextTaken: {
    color: theme.success,
  },
  timeTextSkipped: {
    color: theme.muted,
  },
  timeTextUpcoming: {
    color: theme.warning,
  },
  timeTextOverdue: {
    color: theme.danger,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700' as const,
  },
  rowMeta: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rowStatus: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800' as const,
  },
  rowStatusTaken: {
    color: theme.success,
  },
  rowStatusSkipped: {
    color: theme.muted,
  },
  rowStatusUpcoming: {
    color: theme.warning,
  },
  rowStatusOverdue: {
    color: theme.danger,
  },
  notice: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 100,
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: theme.inverse,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    boxShadow: `0 10px 20px ${theme.shadow}`,
  },
  noticeText: {
    color: theme.onInverse,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  undoButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center' as const,
  },
  undoText: {
    color: theme.inverseAccent,
    fontSize: 15,
    fontWeight: '800' as const,
  },
});
