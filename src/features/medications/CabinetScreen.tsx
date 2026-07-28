import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import { PoraIcon } from '../../ui/PoraIcon';

const colors = {
  blue: '#4658D9',
  blueDark: '#3445BE',
  blueSoft: '#E9EDFF',
  mist: '#F3F5FB',
  paper: '#FFFFFF',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  warning: '#A96320',
  warningSoft: '#FFF2DF',
  success: '#25866C',
  danger: '#A53F37',
};

export interface CabinetScreenProps {
  courses: MedicationCourse[];
  onAdd: () => void;
  onEdit: (course: MedicationCourse) => void;
  onTogglePause: (course: MedicationCourse) => void;
  onChangeStock: (course: MedicationCourse, quantity: number) => void;
  onDelete: (course: MedicationCourse) => void;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

export function CabinetScreen({
  courses,
  onAdd,
  onEdit,
  onTogglePause,
  onChangeStock,
  onDelete,
}: CabinetScreenProps) {
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
          <PoraIcon color={colors.blue} name="plus" size={25} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <PoraIcon color={colors.blue} name="pill" size={25} />
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
            return (
              <View key={course.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.medicineIcon}>
                    <PoraIcon color={colors.blue} name="pill" size={23} />
                  </View>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.medicineName}>
                      {course.medicationName}
                      {course.strength ? ` ${course.strength}` : ''}
                    </Text>
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
                  <Text style={styles.metaValue}>
                    {course.scheduledTimes
                      .map(({ scheduledMinutes }) => formatMinutes(scheduledMinutes))
                      .join(', ')}
                  </Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={styles.metaLabel}>Курс</Text>
                  <Text style={styles.metaValue}>
                    {course.startDay} — {course.endDay ?? 'без даты окончания'}
                  </Text>
                </View>

                <View style={[styles.stockRow, lowStock && styles.stockRowLow]}>
                  <View>
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
                        <PoraIcon color={colors.ink} name="minus" size={20} />
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
                        <PoraIcon color={colors.ink} name="plus" size={20} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  header: {
    minHeight: 136,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.blue,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
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
  lead: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },

  content: { padding: 18, paddingBottom: 112, gap: 13 },
  emptyCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 22,
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
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  primaryButtonText: { color: colors.paper, fontSize: 13, fontWeight: '800' },
  card: {
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  medicineIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitleBlock: { flex: 1, minWidth: 0 },
  medicineName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  doseText: { color: colors.muted, fontSize: 10, marginTop: 3 },
  courseBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#E5F5EF',
  },
  courseBadgePaused: { backgroundColor: '#ECEEF4' },
  courseBadgeText: { color: colors.success, fontSize: 9, fontWeight: '800' },
  courseBadgeTextPaused: { color: colors.muted },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 13,
  },
  metaLabel: { color: colors.muted, fontSize: 10 },
  metaValue: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  stockRow: {
    marginTop: 14,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.blueSoft,
  },
  stockRowLow: { backgroundColor: colors.warningSoft },
  stockCaption: { color: colors.muted, fontSize: 9, marginBottom: 2 },
  stockValue: { color: colors.blueDark, fontSize: 12, fontWeight: '900' },
  stockValueLow: { color: colors.warning },
  stockControls: { flexDirection: 'row', gap: 7 },
  stockButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },

  actions: { flexDirection: 'row', gap: 7, marginTop: 13 },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.blueDark, fontSize: 10, fontWeight: '800' },
  deleteButton: {
    marginLeft: 'auto',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  deleteText: { color: colors.danger, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
