import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
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

const colors = {
  blue: '#4658D9',
  blueDark: '#3344BF',
  blueSoft: '#E9EDFF',
  paper: '#FFFFFF',
  mist: '#F3F5FB',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  apricot: '#FFD8A8',
  coral: '#F17C67',
  success: '#176B55',
  warmText: '#9A5B14',
};

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
  return [item.medicationName, item.strength].filter(Boolean).join(' ');
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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCircleLarge} />
          <View style={styles.heroCircleSmall} />

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
                <PoraIcon color={colors.paper} name="plus" size={25} />
              </Pressable>
              <Pressable
                accessibilityLabel="Профиль и настройки"
                accessibilityRole="button"
                accessibilityState={{ disabled: !onOpenSettings }}
                disabled={!onOpenSettings}
                onPress={onOpenSettings}
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              >
                <PoraIcon color={colors.paper} name="cog-outline" size={23} />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.weekLabel, compact && styles.weekLabelCompact]}>
            {weekView.label}
          </Text>
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
                  <View
                    style={[
                      styles.dayDot,
                      active && styles.dayDotActive,
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {nextDose ? (
            <>
              <View style={[styles.kickerRow, compact && styles.kickerRowCompact]}>
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
              <View style={[styles.actions, compact && styles.actionsCompact]}>
                <Pressable
                  accessibilityLabel="Отметить прием"
                  accessibilityRole="button"
                  onPress={takeCurrentDose}
                  style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
                >
                  <View style={styles.checkBox}>
                    <PoraIcon color={colors.blueDark} name="check" size={15} />
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
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.pressed,
                ]}
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
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.emptyButtonContent}>
                  <PoraIcon color={colors.blueDark} name="plus" size={19} />
                  <Text style={styles.emptyButtonText}>Добавить лекарство</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <View style={styles.finishedBlock}>
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
          {day.doses.length === 0 ? (
            <View style={styles.emptyDayCard}>
              <Text style={styles.emptyDayText}>Расписание пока пустое</Text>
            </View>
          ) : null}
          {day.doses.length > 0 ? (
            <View style={styles.doseList}>
            {day.doses.map((dose) => {
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
                  style={[styles.doseRow, compact && styles.doseRowCompact]}
                >
                  <View
                    style={[
                      styles.timeTile,
                      taken && styles.timeTileTaken,
                      skipped && styles.timeTileSkipped,
                      (upcoming || later) && styles.timeTileUpcoming,
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  scrollContent: {
    paddingBottom: 104,
  },
  hero: {
    minHeight: 350,
    backgroundColor: colors.blue,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroCompact: {
    minHeight: 300,
    paddingBottom: 18,
  },
  heroCircleLarge: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    right: -64,
    top: 84,
  },
  heroCircleSmall: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    right: -32,
    top: 114,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCompact: {
    height: 44,
  },
  wordmark: {
    color: colors.paper,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  weekLabel: {
    marginTop: 10,
    marginBottom: 10,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  weekLabelCompact: {
    marginTop: 4,
    marginBottom: 8,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 5,
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    height: 49,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayCellActive: {
    backgroundColor: colors.paper,
    borderColor: colors.paper,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 9,
  },
  dayLabelActive: {
    color: colors.blue,
  },
  dayDate: {
    color: colors.paper,
    fontSize: 14,
    lineHeight: 15,
    fontWeight: '800',
  },
  dayDateActive: {
    color: colors.ink,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  dayDotActive: {
    backgroundColor: colors.coral,
  },
  kickerRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerRowCompact: {
    marginTop: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.apricot,
    boxShadow: '0 0 5px rgba(255, 216, 168, 0.35)',
  },
  overdueDot: {
    backgroundColor: colors.coral,
  },
  kickerText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontWeight: '700',
  },
  doseTitle: {
    marginTop: 8,
    marginBottom: 4,
    color: colors.paper,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  doseTitleCompact: {
    marginTop: 5,
    fontSize: 26,
    lineHeight: 30,
  },
  doseMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  actionsCompact: {
    marginTop: 10,
  },
  confirmButton: {
    flex: 1,
    minWidth: 0,
    height: 49,
    borderRadius: 16,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    boxShadow: '0 7px 13px rgba(21, 30, 100, 0.20)',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: colors.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  postponeButton: {
    width: 76,
    height: 49,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  postponeText: {
    color: colors.paper,
    fontSize: 12,
    fontWeight: '700',
  },
  skipButton: {
    alignSelf: 'center',
    minHeight: 26,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  skipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  emptyHero: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 22,
    paddingBottom: 2,
  },
  emptyTitle: {
    maxWidth: 330,
    color: colors.paper,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 7,
  },
  emptyText: {
    maxWidth: 345,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  emptyButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  emptyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: colors.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  finishedBlock: {
    minHeight: 116,
    justifyContent: 'flex-end',
  },
  finishedTitle: {
    color: colors.paper,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 5,
  },
  daySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  daySectionCompact: {
    paddingTop: 14,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 11,
  },
  doseList: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  emptyDayCard: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayText: {
    color: colors.muted,
    fontSize: 12,
  },
  doseRow: {
    minHeight: 67,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doseRowCompact: {
    minHeight: 58,
    paddingVertical: 7,
  },
  timeTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTileTaken: {
    backgroundColor: '#E5F5EF',
  },
  timeTileSkipped: {
    backgroundColor: '#ECEEF4',
  },
  timeTileUpcoming: {
    backgroundColor: '#FFF2DF',
  },
  timeText: {
    color: colors.blueDark,
    fontSize: 11,
    fontWeight: '800',
  },
  timeTextTaken: {
    color: colors.success,
  },
  timeTextSkipped: {
    color: colors.muted,
  },
  timeTextUpcoming: {
    color: colors.warmText,
  },
  timeTextOverdue: {
    color: colors.coral,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 10,
  },
  rowStatus: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  rowStatusTaken: {
    color: colors.success,
  },
  rowStatusSkipped: {
    color: colors.muted,
  },
  rowStatusUpcoming: {
    color: colors.warmText,
  },
  rowStatusOverdue: {
    color: colors.coral,
  },
  notice: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 90,
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 8px 16px rgba(23, 32, 59, 0.28)',
  },
  noticeText: {
    color: colors.paper,
    fontSize: 12,
    fontWeight: '700',
  },
  undoButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  undoText: {
    color: colors.apricot,
    fontSize: 11,
    fontWeight: '800',
  },
});
