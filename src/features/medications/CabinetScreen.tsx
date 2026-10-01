import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  sentenceCase,
  shortForm,
  titleCase,
} from '../../catalog/medicationCatalog';
import type { MedicationCourse } from '../../domain/medicationCourse';
import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export interface CabinetScreenProps {
  courses: MedicationCourse[];
  onAdd: () => void;
  onEdit: (course: MedicationCourse) => void;
  onTogglePause: (course: MedicationCourse) => void;
  onChangeStock: (course: MedicationCourse, quantity: number) => void;
  onDelete: (course: MedicationCourse) => void;
}

const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDay(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;
  return `${day} ${months[month - 1]} ${year}`;
}

function periodLabel(course: MedicationCourse) {
  return course.endDay
    ? `${formatDay(course.startDay)} — ${formatDay(course.endDay)}`
    : `с ${formatDay(course.startDay)}, без даты окончания`;
}

function stockLabel(course: MedicationCourse) {
  if (course.stockQuantity === null) return 'Остаток не указан';
  const value = `${course.stockQuantity} ${course.stockUnit ?? 'ед.'}`;
  if (
    course.lowStockThreshold !== null &&
    course.stockQuantity <= course.lowStockThreshold
  ) {
    return `Мало: ${value}`;
  }
  return `Осталось: ${value}`;
}

/** "Ибупрофен · Капсулы · Патеон Софтджелс Б.В." — only what the directory supplied. */
function catalogLine(course: MedicationCourse) {
  return [
    course.inn ? sentenceCase(course.inn) : '',
    course.form ? shortForm(course.form) : '',
    course.manufacturer ? titleCase(course.manufacturer) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function CabinetScreen({
  courses,
  onAdd,
  onEdit,
  onTogglePause,
  onChangeStock,
  onDelete,
}: CabinetScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ЛИЧНЫЕ НАЗНАЧЕНИЯ</Text>
          <Text style={styles.title}>Аптечка</Text>
          <Text style={styles.lead}>
            Курсы, расписание и фактический остаток
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Добавить лекарство"
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <PoraIcon color={theme.onPrimary} name="plus" size={26} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <PoraIcon color={theme.primaryInk} name="pill" size={30} />
            </View>
            <Text style={styles.emptyTitle}>В аптечке пока пусто</Text>
            <Text style={styles.emptyText}>
              Добавьте назначенное лекарство, время приема и текущий остаток.
            </Text>
            <Pressable
              accessibilityLabel="Добавить первое лекарство в аптечку"
              accessibilityRole="button"
              onPress={onAdd}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Добавить лекарство</Text>
            </Pressable>
          </View>
        ) : (
          courses.map((course) => {
            const lowStock =
              course.stockQuantity !== null &&
              course.lowStockThreshold !== null &&
              course.stockQuantity <= course.lowStockThreshold;
            const details = catalogLine(course);
            return (
              <View
                key={course.id}
                style={[styles.card, course.isPaused && styles.cardPaused]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.medicineIcon}>
                    <PoraIcon color={theme.primaryInk} name="pill" size={24} />
                  </View>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.medicineName}>
                      {course.medicationName}
                      {course.strength ? ` ${course.strength}` : ''}
                    </Text>
                    {details ? <Text style={styles.detailsText}>{details}</Text> : null}
                    <Text style={styles.doseText}>
                      {[course.dose, course.foodRelation].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.courseBadge,
                      course.isPaused && styles.courseBadgePaused,
                    ]}
                  >
                    <Text
                      style={[
                        styles.courseBadgeText,
                        course.isPaused && styles.courseBadgeTextPaused,
                      ]}
                    >
                      {course.isPaused ? 'Пауза' : 'Активен'}
                    </Text>
                  </View>
                </View>

                <View style={styles.scheduleRow}>
                  <Text style={styles.metaLabel}>Время</Text>
                  <View style={styles.timeChips}>
                    {course.scheduledTimes.map(({ id, scheduledMinutes }) => (
                      <View key={id} style={styles.timeChip}>
                        <Text style={styles.timeChipText}>{formatMinutes(scheduledMinutes)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={styles.metaLabel}>Курс</Text>
                  <Text style={styles.metaValue}>{periodLabel(course)}</Text>
                </View>

                <View style={[styles.stockRow, lowStock && styles.stockRowLow]}>
                  <View style={styles.stockCopy}>
                    <Text style={styles.stockCaption}>Остаток</Text>
                    <Text style={[styles.stockValue, lowStock && styles.stockValueLow]}>
                      {stockLabel(course)}
                    </Text>
                  </View>
                  {course.stockQuantity !== null ? (
                    <View style={styles.stockControls}>
                      <Pressable
                        accessibilityLabel={`Уменьшить остаток ${course.medicationName}`}
                        accessibilityRole="button"
                        hitSlop={5}
                        onPress={() =>
                          onChangeStock(
                            course,
                            Math.max(0, course.stockQuantity! - 1),
                          )
                        }
                        style={({ pressed }) => [
                          styles.stockButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <PoraIcon color={theme.ink} name="minus" size={22} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Увеличить остаток ${course.medicationName}`}
                        accessibilityRole="button"
                        hitSlop={5}
                        onPress={() =>
                          onChangeStock(course, course.stockQuantity! + 1)
                        }
                        style={({ pressed }) => [
                          styles.stockButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <PoraIcon color={theme.ink} name="plus" size={22} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityLabel={`${course.isPaused ? 'Возобновить' : 'Приостановить'} курс ${course.medicationName}`}
                    accessibilityRole="button"
                    onPress={() => onTogglePause(course)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {course.isPaused ? 'Возобновить' : 'Пауза'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Изменить курс ${course.medicationName}`}
                    accessibilityRole="button"
                    onPress={() => onEdit(course)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Изменить</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Удалить курс ${course.medicationName}`}
                    accessibilityRole="button"
                    onPress={() => onDelete(course)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.deleteText}>Удалить</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
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
    justifyContent: 'space-between' as const,
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
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
  lead: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
    boxShadow: `0 6px 14px ${theme.shadow}`,
  },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
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
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%' as const,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  primaryButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '800' as const },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    padding: 16,
  },
  cardPaused: { opacity: 0.82 },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  medicineIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: theme.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  medicineName: { color: theme.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' as const },
  detailsText: { color: theme.primaryInk, fontSize: 12, lineHeight: 17, marginTop: 2 },
  doseText: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  courseBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.successSoft,
  },
  courseBadgePaused: { backgroundColor: theme.surfaceAlt },
  courseBadgeText: { color: theme.success, fontSize: 12, fontWeight: '800' as const },
  courseBadgeTextPaused: { color: theme.muted },
  scheduleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    marginTop: 14,
  },
  metaLabel: { color: theme.muted, fontSize: 13 },
  metaValue: {
    flex: 1,
    color: theme.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  timeChips: {
    flex: 1,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end' as const,
    gap: 6,
  },
  timeChip: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: theme.surfaceAlt,
  },
  timeChipText: { color: theme.ink, fontSize: 14, fontWeight: '800' as const },
  stockRow: {
    marginTop: 16,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: theme.primarySoft,
  },
  stockRowLow: { backgroundColor: theme.warningSoft },
  stockCopy: { flex: 1, minWidth: 0 },
  stockCaption: { color: theme.muted, fontSize: 12, lineHeight: 16 },
  stockValue: { color: theme.primaryInk, fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
  stockValueLow: { color: theme.warning },
  stockControls: { flexDirection: 'row' as const, gap: 8 },
  stockButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 14,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryButtonText: { color: theme.primaryInk, fontSize: 13, fontWeight: '800' as const },
  deleteButton: {
    marginLeft: 'auto' as const,
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: 8,
  },
  deleteText: { color: theme.danger, fontSize: 13, fontWeight: '700' as const },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
