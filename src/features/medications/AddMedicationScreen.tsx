import React, { useState } from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  normalizeCourseInput,
  parseTimeList,
  type MedicationCourse,
  type NewMedicationCourseInput,
} from '../../domain/medicationCourse';
import { toLocalDayKey } from '../../domain/localDay';
import { PoraIcon } from '../../ui/PoraIcon';

const colors = {
  blue: '#4658D9',
  blueDark: '#3445BE',
  mist: '#F3F5FB',
  paper: '#FFFFFF',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  error: '#A53F37',
};

export interface AddMedicationScreenProps {
  course?: MedicationCourse;
  now?: () => Date;
  onCancel: () => void;
  onSave: (input: NewMedicationCourseInput) => Promise<void> | void;
}

interface FieldProps {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation';
  helper?: string;
}

type PickerTarget =
  | { kind: 'time'; index: number; removeOnDismiss?: boolean }
  | { kind: 'start' }
  | { kind: 'end' };

const monthNames = [
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

function minutesToTime(scheduledMinutes: number) {
  const hours = Math.floor(scheduledMinutes / 60);
  const minutes = scheduledMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToDate(value: string, referenceDate: Date) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    hours,
    minutes,
  );
}

function dateToTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function dayKeyToDate(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDay(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return `${day} ${monthNames[month - 1]} ${year}`;
}

function suggestedTime(times: string[]) {
  return (
    ['21:00', '12:00', '18:00', '08:00'].find(
      (candidate) => !times.includes(candidate),
    ) ?? '09:00'
  );
}

function Field({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  helper,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A7B9"
        style={styles.input}
        value={value}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function optionalNumber(value: string, label: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Проверьте поле «${label}»`);
  return number;
}

export function AddMedicationScreen({
  course,
  now = () => new Date(),
  onCancel,
  onSave,
}: AddMedicationScreenProps) {
  const [referenceDate] = useState(now);
  const [medicationName, setMedicationName] = useState(course?.medicationName ?? '');
  const [strength, setStrength] = useState(course?.strength ?? '');
  const [dose, setDose] = useState(course?.dose ?? '');
  const [foodRelation, setFoodRelation] = useState(course?.foodRelation ?? '');
  const [times, setTimes] = useState<string[]>(() =>
    course
      ? course.scheduledTimes
          .map(({ scheduledMinutes }) => minutesToTime(scheduledMinutes))
      : ['09:00'],
  );
  const [startDay, setStartDay] = useState(
    course?.startDay ?? toLocalDayKey(referenceDate),
  );
  const [endDay, setEndDay] = useState(course?.endDay ?? '');
  const [stockQuantity, setStockQuantity] = useState(
    course?.stockQuantity === null || course?.stockQuantity === undefined
      ? ''
      : String(course.stockQuantity),
  );
  const [stockUnit, setStockUnit] = useState(course?.stockUnit ?? 'таблеток');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    course?.lowStockThreshold === null || course?.lowStockThreshold === undefined
      ? '5'
      : String(course.lowStockThreshold),
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>();

  function pickerValue(target: PickerTarget) {
    if (target.kind === 'time') {
      return timeToDate(times[target.index] ?? '09:00', referenceDate);
    }
    return dayKeyToDate(
      target.kind === 'start' ? startDay : endDay || startDay,
    );
  }

  function selectPickerValue(
    _event: DateTimePickerChangeEvent,
    selected: Date,
  ) {
    if (!pickerTarget) return;
    if (pickerTarget.kind === 'time') {
      setTimes((current) =>
        current.map((time, index) =>
          index === pickerTarget.index ? dateToTime(selected) : time,
        ),
      );
    } else {
      const dayKey = toLocalDayKey(selected);
      if (pickerTarget.kind === 'start') {
        setStartDay(dayKey);
        if (endDay && endDay < dayKey) setEndDay('');
      } else {
        setEndDay(dayKey);
      }
    }
    if (Platform.OS === 'android') setPickerTarget(undefined);
  }

  function addTime() {
    setTimes((current) => {
      const next = [...current, suggestedTime(current)];
      setPickerTarget({
        kind: 'time',
        index: next.length - 1,
        removeOnDismiss: true,
      });
      return next;
    });
  }

  function dismissPicker() {
    if (pickerTarget?.kind === 'time' && pickerTarget.removeOnDismiss) {
      setTimes((current) =>
        current.filter((_, index) => index !== pickerTarget.index),
      );
    }
    setPickerTarget(undefined);
  }

  function removeTime(index: number) {
    setPickerTarget(undefined);
    setTimes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit() {
    if (saving) return;
    setError(undefined);
    try {
      const input = normalizeCourseInput({
        medicationName,
        strength,
        dose,
        foodRelation,
        startDay: startDay.trim(),
        endDay: endDay.trim() || null,
        scheduledMinutes: parseTimeList(times.join(', ')),
        stockQuantity: optionalNumber(stockQuantity, 'Остаток'),
        stockUnit,
        lowStockThreshold: optionalNumber(
          lowStockThreshold,
          'Предупредить при остатке',
        ),
      });
      setSaving(true);
      await onSave(input);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить курс');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Закрыть добавление лекарства"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onCancel}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <PoraIcon color={colors.paper} name="arrow-left" size={23} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{course ? 'КУРС И РАСПИСАНИЕ' : 'НОВЫЙ КУРС'}</Text>
          <Text style={styles.title}>
            {course ? 'Изменить лекарство' : 'Добавить лекарство'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.notice}>
          Запишите назначение врача. Приложение не меняет дозировку и не дает медицинских рекомендаций.
        </Text>

        <View style={styles.card}>
          <Field
            accessibilityLabel="Название лекарства"
            label="Название лекарства *"
            onChangeText={setMedicationName}
            placeholder="Например, Телмисартан"
            value={medicationName}
          />
          <Field
            accessibilityLabel="Дозировка препарата"
            label="Дозировка препарата"
            onChangeText={setStrength}
            placeholder="Например, 40 мг"
            value={strength}
          />
          <Field
            accessibilityLabel="Сколько за один прием"
            label="Сколько за один прием *"
            onChangeText={setDose}
            placeholder="Например, 1 таблетка"
            value={dose}
          />
          <Field
            accessibilityLabel="Связь с едой"
            label="Связь с едой"
            onChangeText={setFoodRelation}
            placeholder="Например, после завтрака"
            value={foodRelation}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Расписание</Text>
          <Text style={styles.scheduleHint}>
            Нажмите на время или дату, чтобы выбрать их прокруткой.
          </Text>

          <View style={styles.pickerGroup}>
            <Text style={styles.label}>Время приема *</Text>
            <View style={styles.timeList}>
              {times.map((time, index) => (
                <View key={`${index}-${time}`} style={styles.timeRow}>
                  <Pressable
                    accessibilityLabel={`Выбрать время: ${time}`}
                    accessibilityRole="button"
                    onPress={() => setPickerTarget({ kind: 'time', index })}
                    style={({ pressed }) => [
                      styles.pickerButton,
                      styles.timePickerButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.pickerIcon}>
                      <PoraIcon color={colors.blue} name="clock-outline" size={19} />
                    </View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerCaption}>Прием {index + 1}</Text>
                      <Text style={styles.timeValue}>{time}</Text>
                    </View>
                    <PoraIcon
                      color={colors.muted}
                      name="unfold-more-horizontal"
                      size={20}
                    />
                  </Pressable>
                  {times.length > 1 ? (
                    <Pressable
                      accessibilityLabel={`Удалить время: ${time}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => removeTime(index)}
                      style={({ pressed }) => [
                        styles.removeTimeButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <PoraIcon color={colors.error} name="close" size={19} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Pressable
              accessibilityLabel="Добавить время приема"
              accessibilityRole="button"
              onPress={addTime}
              style={({ pressed }) => [styles.addTimeButton, pressed && styles.pressed]}
            >
              <PoraIcon color={colors.blue} name="plus" size={18} />
              <Text style={styles.addTimeText}>Добавить время</Text>
            </Pressable>
          </View>

          <View style={styles.scheduleDivider} />

          <View style={styles.pickerGroup}>
            <Text style={styles.label}>Период курса</Text>
            <Pressable
              accessibilityLabel={`Выбрать дату начала: ${startDay}`}
              accessibilityRole="button"
              onPress={() => setPickerTarget({ kind: 'start' })}
              style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
            >
              <View style={styles.pickerIcon}>
                <PoraIcon color={colors.blue} name="calendar-start" size={19} />
              </View>
              <View style={styles.pickerCopy}>
                <Text style={styles.pickerCaption}>Начало</Text>
                <Text style={styles.dateValue}>{formatDay(startDay)}</Text>
              </View>
              <PoraIcon
                color={colors.muted}
                name="unfold-more-horizontal"
                size={20}
              />
            </Pressable>

            {endDay ? (
              <View style={styles.timeRow}>
                <Pressable
                  accessibilityLabel={`Выбрать дату окончания: ${endDay}`}
                  accessibilityRole="button"
                  onPress={() => setPickerTarget({ kind: 'end' })}
                  style={({ pressed }) => [
                    styles.pickerButton,
                    styles.timePickerButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.pickerIcon}>
                    <PoraIcon color={colors.blue} name="calendar-end" size={19} />
                  </View>
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerCaption}>Окончание</Text>
                    <Text style={styles.dateValue}>{formatDay(endDay)}</Text>
                  </View>
                  <PoraIcon
                    color={colors.muted}
                    name="unfold-more-horizontal"
                    size={20}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Убрать дату окончания"
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => setEndDay('')}
                  style={({ pressed }) => [
                    styles.removeTimeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <PoraIcon color={colors.error} name="close" size={19} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="Добавить дату окончания"
                accessibilityRole="button"
                onPress={() => setPickerTarget({ kind: 'end' })}
                style={({ pressed }) => [
                  styles.optionalDateButton,
                  pressed && styles.pressed,
                ]}
              >
                <PoraIcon color={colors.blue} name="calendar-plus" size={18} />
                <View style={styles.pickerCopy}>
                  <Text style={styles.optionalDateTitle}>Добавить дату окончания</Text>
                  <Text style={styles.helper}>Необязательно — для постоянного курса</Text>
                </View>
              </Pressable>
            )}
          </View>

          {pickerTarget && Platform.OS !== 'web' ? (
            <View style={Platform.OS === 'ios' ? styles.inlinePicker : undefined}>
              <DateTimePicker
                display="spinner"
                is24Hour
                minimumDate={
                  pickerTarget.kind === 'end'
                    ? dayKeyToDate(startDay)
                    : undefined
                }
                mode={pickerTarget.kind === 'time' ? 'time' : 'date'}
                negativeButton={{ label: 'Отмена' }}
                onDismiss={dismissPicker}
                onValueChange={selectPickerValue}
                positiveButton={{ label: 'Готово' }}
                testID="native-date-time-picker"
                value={pickerValue(pickerTarget)}
              />
              {Platform.OS === 'ios' ? (
                <Pressable
                  accessibilityLabel="Закрыть выбор даты и времени"
                  accessibilityRole="button"
                  onPress={() => setPickerTarget(undefined)}
                  style={styles.pickerDoneButton}
                >
                  <Text style={styles.pickerDoneText}>Готово</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Остаток</Text>
          <Field
            accessibilityLabel="Остаток"
            keyboardType="decimal-pad"
            label="Сколько осталось"
            onChangeText={setStockQuantity}
            placeholder="Например, 28"
            value={stockQuantity}
          />
          <Field
            accessibilityLabel="Единица остатка"
            label="Единица"
            onChangeText={setStockUnit}
            placeholder="таблеток"
            value={stockUnit}
          />
          <Field
            accessibilityLabel="Предупредить при остатке"
            keyboardType="decimal-pad"
            label="Предупредить, когда останется"
            onChangeText={setLowStockThreshold}
            placeholder="5"
            value={lowStockThreshold}
          />
        </View>

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Сохранить курс"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={submit}
          style={({ pressed }) => [
            styles.saveButton,
            saving && styles.saveButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveText}>
            {saving
              ? 'Сохраняем…'
              : course
                ? 'Сохранить изменения'
                : 'Сохранить курс'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  header: {
    minHeight: 116,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.blue,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    color: colors.paper,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
    gap: 14,
  },
  notice: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 3,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 16,
    gap: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: -2,
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    minHeight: 47,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.ink,
    backgroundColor: '#FAFBFE',
    fontSize: 13,
  },
  helper: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
  },
  scheduleHint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: -5,
  },
  pickerGroup: {
    gap: 9,
  },
  timeList: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerButton: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAFBFE',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  timePickerButton: {
    flex: 1,
  },
  pickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0FF',
  },
  pickerCopy: {
    flex: 1,
    minWidth: 0,
  },
  pickerCaption: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  timeValue: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  dateValue: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  removeTimeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE9E7',
  },
  addTimeButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CDD3F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F7F8FF',
  },
  addTimeText: {
    color: colors.blueDark,
    fontSize: 11,
    fontWeight: '900',
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: colors.line,
  },
  optionalDateButton: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CDD3F7',
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FBFBFF',
  },
  optionalDateTitle: {
    color: colors.blueDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  inlinePicker: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  pickerDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '900',
  },
  errorBox: {
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FCE9E7',
  },
  errorText: {
    color: colors.error,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  saveButtonDisabled: {
    opacity: 0.62,
  },
  saveText: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
