import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import type { MedicationEvent } from '../../domain/medicationDay';
import { toLocalDayKey } from '../../domain/localDay';
import { PoraIcon } from '../../ui/PoraIcon';

const colors = {
  blue: '#4658D9',
  blueSoft: '#E9EDFF',
  mist: '#F3F5FB',
  paper: '#FFFFFF',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  success: '#25866C',
  warning: '#A96320',
  danger: '#A53F37',
};

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
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function HistoryScreen({ courses, events, onExport }: HistoryScreenProps) {
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
          <PoraIcon color={colors.blue} name="file-export-outline" size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <PoraIcon color={colors.blue} name="history" size={25} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  header: {
    minHeight: 136,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  title: {
    color: colors.paper,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  lead: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 4 },
  exportButton: {
    width: 44,
    height: 44,
    marginLeft: 12,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },

  content: { padding: 18, paddingBottom: 112, gap: 18 },
  emptyCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 6,
  },
  group: { gap: 8 },
  dayTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
    paddingHorizontal: 3,
  },
  dayCard: {
    overflow: 'hidden',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  statusDot: { width: 9, height: 9, borderRadius: 999, marginTop: 4, marginRight: 11 },
  dot_success: { backgroundColor: colors.success },
  dot_warning: { backgroundColor: colors.warning },
  dot_danger: { backgroundColor: colors.danger },
  dot_muted: { backgroundColor: colors.muted },
  rowCopy: { flex: 1, minWidth: 0 },
  medicineName: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  detail: { color: colors.muted, fontSize: 9, marginTop: 2 },
  status: { fontSize: 10, fontWeight: '800', marginTop: 6 },
  status_success: { color: colors.success },
  status_warning: { color: colors.warning },
  status_danger: { color: colors.danger },
  status_muted: { color: colors.muted },
  time: { color: colors.muted, fontSize: 10, fontWeight: '700', marginLeft: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
