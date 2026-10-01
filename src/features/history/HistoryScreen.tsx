import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import type { MedicationEvent } from '../../domain/medicationDay';
import { toLocalDayKey } from '../../domain/localDay';
import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

interface HistoryRow {
  id: string;
  dayKey: string;
  medicationLabel: string;
  detail: string;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
  recordedTime: string;
}

export interface HistoryScreenProps {
  courses: MedicationCourse[];
  events: MedicationEvent[];
  onExport: () => void;
}

function historyDoseId(event: MedicationEvent, events: MedicationEvent[]) {
  if (event.type !== 'undone') return event.doseId;
  const target = events.find(({ id }) => id === event.targetEventId);
  return target && target.type !== 'undone' ? target.doseId : undefined;
}

function eventStatus(event: MedicationEvent) {
  switch (event.type) {
    case 'taken':
      return { status: 'Принято', tone: 'success' as const };
    case 'postponed': {
      const hours = Math.floor(event.minutes / 60);
      const minutes = event.minutes % 60;
      return {
        status: `Перенесено на ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        tone: 'warning' as const,
      };
    }
    case 'skipped':
      return { status: 'Пропущено', tone: 'danger' as const };
    case 'undone':
      return { status: 'Действие отменено', tone: 'muted' as const };
  }
}

export function buildHistoryRows(
  courses: MedicationCourse[],
  events: MedicationEvent[],
): HistoryRow[] {
  const courseByTimeId = new Map<string, MedicationCourse>();
  for (const course of courses) {
    for (const time of course.scheduledTimes) courseByTimeId.set(time.id, course);
  }

  return [...events]
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .map((event) => {
      const sourceEvent =
        event.type === 'undone'
          ? events.find(({ id }) => id === event.targetEventId)
          : event;
      const course = courseByTimeId.get(historyDoseId(event, events) ?? '');
      const snapshot =
        sourceEvent && sourceEvent.type !== 'undone' ? sourceEvent : undefined;
      const outcome = eventStatus(event);
      const recorded = new Date(event.recordedAt);
      return {
        id: event.id,
        dayKey:
          event.dayKey ??
          (Number.isNaN(recorded.getTime()) ? 'unknown' : toLocalDayKey(recorded)),
        medicationLabel: snapshot?.medicationName
          ? `${snapshot.medicationName}${snapshot.strength ? ` ${snapshot.strength}` : ''}`
          : course
            ? `${course.medicationName}${course.strength ? ` ${course.strength}` : ''}`
            : 'Лекарство из истории',
        detail: snapshot?.dose ?? course?.dose ?? 'Назначение изменено или удалено',
        ...outcome,
        recordedTime: Number.isNaN(recorded.getTime())
          ? ''
          : recorded.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            }),
      };
    });
}

function formatDay(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dayKey;
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function HistoryScreen({ courses, events, onExport }: HistoryScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const rows = useMemo(() => buildHistoryRows(courses, events), [courses, events]);
  const groups = useMemo(() => {
    const grouped = new Map<string, HistoryRow[]>();
    for (const row of rows) grouped.set(row.dayKey, [...(grouped.get(row.dayKey) ?? []), row]);
    return [...grouped.entries()];
  }, [rows]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ФАКТИЧЕСКИЕ ДЕЙСТВИЯ</Text>
          <Text style={styles.title}>История</Text>
          <Text style={styles.lead}>Отметки сохраняются и не удаляются при отмене</Text>
        </View>
        <Pressable
          accessibilityLabel="Экспортировать историю"
          accessibilityRole="button"
          onPress={onExport}
          style={({ pressed }) => [styles.exportButton, pressed && styles.pressed]}
        >
          <PoraIcon color={theme.primaryInk} name="file-export-outline" size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <PoraIcon color={theme.primaryInk} name="history" size={30} />
            </View>
            <Text style={styles.emptyTitle}>История пока пуста</Text>
            <Text style={styles.emptyText}>
              После первой отметки здесь появится то, что фактически произошло.
            </Text>
          </View>
        ) : (
          groups.map(([dayKey, dayRows]) => (
            <View key={dayKey} style={styles.group}>
              <Text style={styles.dayTitle}>{formatDay(dayKey)}</Text>
              <View style={styles.dayCard}>
                {dayRows.map((row, index) => (
                  <View
                    key={row.id}
                    style={[styles.row, index > 0 && styles.rowBorder]}
                  >
                    <View style={[styles.statusDot, styles[`dot_${row.tone}`]]} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.medicineName}>{row.medicationLabel}</Text>
                      <Text style={styles.detail}>{row.detail}</Text>
                      <Text style={[styles.status, styles[`status_${row.tone}`]]}>
                        {row.status}
                      </Text>
                    </View>
                    <Text style={styles.time}>{row.recordedTime}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: theme.primaryInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  title: {
    color: theme.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  lead: { color: theme.muted, fontSize: 14, lineHeight: 19, marginTop: 2 },
  exportButton: {
    width: 52,
    height: 52,
    marginLeft: 12,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  content: { padding: 16, paddingBottom: 120, gap: 18 },
  emptyCard: {
    marginTop: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    padding: 26,
    alignItems: 'center' as const,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  emptyTitle: { color: theme.ink, fontSize: 20, lineHeight: 26, fontWeight: '800' as const },
  emptyText: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    maxWidth: 290,
    marginTop: 6,
  },
  group: { gap: 8 },
  dayTitle: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800' as const,
    paddingHorizontal: 4,
  },
  dayCard: {
    overflow: 'hidden' as const,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  row: { minHeight: 76, flexDirection: 'row' as const, alignItems: 'flex-start' as const, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: theme.line },
  statusDot: { width: 10, height: 10, borderRadius: 999, marginTop: 6, marginRight: 12 },
  dot_success: { backgroundColor: theme.success },
  dot_warning: { backgroundColor: theme.warning },
  dot_danger: { backgroundColor: theme.danger },
  dot_muted: { backgroundColor: theme.muted },
  rowCopy: { flex: 1, minWidth: 0 },
  medicineName: { color: theme.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
  detail: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 1 },
  status: { fontSize: 13, lineHeight: 18, fontWeight: '800' as const, marginTop: 5 },
  status_success: { color: theme.success },
  status_warning: { color: theme.warning },
  status_danger: { color: theme.danger },
  status_muted: { color: theme.muted },
  time: { color: theme.muted, fontSize: 13, fontWeight: '700' as const, marginLeft: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
