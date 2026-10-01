import React, { useEffect, useRef, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  catalogSourceLabel,
  sentenceCase,
  shortForm,
  stockUnitForForm,
  suggestedDoseForForm,
  titleCase,
  type MedicationCatalogItem,
} from '../../catalog/medicationCatalog';
import {
  normalizeCourseInput,
  parseTimeList,
  type MedicationCatalogReference,
  type MedicationCourse,
  type NewMedicationCourseInput,
} from '../../domain/medicationCourse';
import { toLocalDayKey } from '../../domain/localDay';
import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export type CatalogInitializationState = 'loading' | 'ready' | 'unavailable';
export type SearchCatalog = (query: string) => Promise<MedicationCatalogItem[]>;

export interface AddMedicationScreenProps {
  course?: MedicationCourse;
  now?: () => Date;
  /** Whether the bundled ЕСКЛП directory is usable. Without it the form is a plain form. */
  catalogInitializationState?: CatalogInitializationState;
  searchCatalog?: SearchCatalog;
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

interface SelectedMedicine extends MedicationCatalogReference {
  form?: string;
}

const SEARCH_DELAY_MS = 160;
// The directory returns up to 20 matches; the form shows the best few so the rest of it stays reachable.
const VISIBLE_SUGGESTIONS = 8;

const foodChoices = ['до еды', 'во время еды', 'после еды', 'натощак'];

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

function optionalNumber(value: string, label: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Проверьте поле «${label}»`);
  return number;
}

function referenceOf(course: MedicationCourse | undefined): SelectedMedicine | undefined {
  if (!course?.catalogItemUuid) return undefined;
  return {
    ...(course.form ? { form: course.form } : {}),
    ...(course.catalogSource ? { catalogSource: course.catalogSource } : {}),
    ...(course.catalogVersion ? { catalogVersion: course.catalogVersion } : {}),
    catalogItemUuid: course.catalogItemUuid,
    ...(course.catalogItemCode ? { catalogItemCode: course.catalogItemCode } : {}),
    ...(course.inn ? { inn: course.inn } : {}),
    ...(course.registrationNumber ? { registrationNumber: course.registrationNumber } : {}),
    ...(course.manufacturer ? { manufacturer: course.manufacturer } : {}),
  };
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
  const theme = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        style={styles.input}
        value={value}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function suggestionDetails(item: MedicationCatalogItem): string {
  return [sentenceCase(item.inn), item.dosage, shortForm(item.form)]
    .filter(Boolean)
    .join(' · ');
}

export function AddMedicationScreen({
  course,
  now = () => new Date(),
  catalogInitializationState = 'unavailable',
  searchCatalog,
  onCancel,
  onSave,
}: AddMedicationScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [referenceDate] = useState(now);
  const [medicationName, setMedicationName] = useState(course?.medicationName ?? '');
  const [strength, setStrength] = useState(course?.strength ?? '');
  const [dose, setDose] = useState(course?.dose ?? '');
  const [foodRelation, setFoodRelation] = useState(course?.foodRelation ?? '');
  const [selected, setSelected] = useState<SelectedMedicine | undefined>(() => referenceOf(course));
  const [suggestions, setSuggestions] = useState<MedicationCatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchSequence = useRef(0);
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

  const catalogReady = catalogInitializationState === 'ready' && Boolean(searchCatalog);
  const query = medicationName.trim();

  useEffect(() => {
    if (!catalogReady || !searchCatalog || !suggestionsOpen || query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const sequence = ++searchSequence.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchCatalog(query).then(
        (items) => {
          if (sequence !== searchSequence.current) return;
          setSuggestions(items);
          setSearching(false);
        },
        () => {
          if (sequence !== searchSequence.current) return;
          setSuggestions([]);
          setSearching(false);
        },
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [catalogReady, query, searchCatalog, suggestionsOpen]);

  function changeName(value: string) {
    setMedicationName(value);
    setSuggestionsOpen(true);
    // A name edited by hand no longer describes the entry that was picked from the directory.
    if (selected) setSelected(undefined);
  }

  function chooseSuggestion(item: MedicationCatalogItem) {
    setMedicationName(item.tradeName);
    if (item.dosage) setStrength(item.dosage);
    const form = sentenceCase(item.form);
    if (!dose.trim()) {
      const suggestedDose = suggestedDoseForForm(item.form);
      if (suggestedDose) setDose(suggestedDose);
    }
    if (!stockQuantity.trim()) {
      const unit = stockUnitForForm(item.form);
      if (unit) setStockUnit(unit);
    }
    setSelected({
      ...(form ? { form } : {}),
      catalogSource: 'esklp',
      catalogVersion: item.catalogVersion,
      catalogItemUuid: item.sourceUuid,
      catalogItemCode: item.sourceCode,
      ...(item.inn ? { inn: item.inn } : {}),
      ...(item.registrationNumber ? { registrationNumber: item.registrationNumber } : {}),
      ...(item.manufacturer ? { manufacturer: item.manufacturer } : {}),
    });
    setSuggestionsOpen(false);
    setSuggestions([]);
    setError(undefined);
  }

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
    selectedDate: Date,
  ) {
    if (!pickerTarget) return;
    if (pickerTarget.kind === 'time') {
      setTimes((current) =>
        current.map((time, index) =>
          index === pickerTarget.index ? dateToTime(selectedDate) : time,
        ),
      );
    } else {
      const dayKey = toLocalDayKey(selectedDate);
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
        ...selected,
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

  const showSuggestionList =
    catalogReady && suggestionsOpen && !selected && query.length >= 2;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Закрыть добавление лекарства"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onCancel}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <PoraIcon color={theme.ink} name="arrow-left" size={24} />
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
            onChangeText={changeName}
            placeholder="Например, Телмисартан"
            value={medicationName}
          />

          {catalogInitializationState === 'loading' && !selected ? (
            <Text style={styles.catalogHint}>Подключаем справочник ЕСКЛП…</Text>
          ) : null}
          {catalogInitializationState === 'unavailable' && !selected ? (
            <Text style={styles.catalogHint}>
              Справочник ЕСКЛП не открылся. Название можно ввести вручную.
            </Text>
          ) : null}
          {catalogReady && !selected && !showSuggestionList ? (
            <View style={styles.catalogHintRow}>
              <PoraIcon color={theme.primaryInk} name="magnify" size={16} />
              <Text style={styles.catalogHint}>
                Начните вводить название — или оставьте свой вариант вручную.
              </Text>
            </View>
          ) : null}

          {showSuggestionList ? (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>Подсказки ЕСКЛП</Text>
              {searching && suggestions.length === 0 ? (
                <Text style={styles.suggestionsEmpty}>Ищем в ЕСКЛП…</Text>
              ) : null}
              {!searching && suggestions.length === 0 ? (
                <Text style={styles.suggestionsEmpty}>
                  В ЕСКЛП ничего не найдено. Название можно оставить вручную.
                </Text>
              ) : null}
              {suggestions.slice(0, VISIBLE_SUGGESTIONS).map((item) => (
                <Pressable
                  accessibilityLabel={`Выбрать лекарство: ${item.tradeName}, ${item.dosage || 'без дозировки'}, ${item.form ? sentenceCase(item.form) : 'форма не указана'}`}
                  accessibilityRole="button"
                  key={item.sourceUuid}
                  onPress={() => chooseSuggestion(item)}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                >
                  <View style={styles.suggestionCopy}>
                    <Text numberOfLines={1} style={styles.suggestionName}>
                      {item.tradeName}
                    </Text>
                    <Text numberOfLines={2} style={styles.suggestionMeta}>
                      {suggestionDetails(item) || 'без дозировки'}
                    </Text>
                  </View>
                  {item.isZnvlp ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>ЖНВЛП</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {suggestions.length > VISIBLE_SUGGESTIONS ? (
                <Text style={styles.suggestionsMore}>Показаны лучшие совпадения — уточните название</Text>
              ) : null}
              <Text style={styles.source}>
                Источник: {catalogSourceLabel(suggestions[0]?.catalogVersion ?? '')}
              </Text>
            </View>
          ) : null}

          {selected ? (
            <View style={styles.selected}>
              <View style={styles.selectedIcon}>
                <PoraIcon color={theme.onPrimary} name="check" size={16} />
              </View>
              <View style={styles.selectedCopy}>
                <Text style={styles.selectedTitle}>Из справочника ЕСКЛП</Text>
                <Text style={styles.selectedMeta}>
                  {[
                    selected.inn ? sentenceCase(selected.inn) : '',
                    selected.form ? shortForm(selected.form) : '',
                    selected.manufacturer ? titleCase(selected.manufacturer) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Запись справочника'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Не использовать подсказку из справочника"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSelected(undefined)}
                style={({ pressed }) => [styles.selectedClear, pressed && styles.pressed]}
              >
                <PoraIcon color={theme.muted} name="close" size={18} />
              </Pressable>
            </View>
          ) : null}

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
          <View style={styles.chips}>
            {foodChoices.map((choice) => {
              const active = foodRelation.trim().toLowerCase() === choice;
              return (
                <Pressable
                  accessibilityLabel={`Связь с едой: ${choice}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={choice}
                  onPress={() => setFoodRelation(active ? '' : choice)}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {choice}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
                      <PoraIcon color={theme.primaryInk} name="clock-outline" size={20} />
                    </View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerCaption}>Прием {index + 1}</Text>
                      <Text style={styles.timeValue}>{time}</Text>
                    </View>
                    <PoraIcon
                      color={theme.muted}
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
                      <PoraIcon color={theme.danger} name="close" size={20} />
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
              <PoraIcon color={theme.primaryInk} name="plus" size={18} />
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
                <PoraIcon color={theme.primaryInk} name="calendar-start" size={20} />
              </View>
              <View style={styles.pickerCopy}>
                <Text style={styles.pickerCaption}>Начало</Text>
                <Text style={styles.dateValue}>{formatDay(startDay)}</Text>
              </View>
              <PoraIcon
                color={theme.muted}
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
                    <PoraIcon color={theme.primaryInk} name="calendar-end" size={20} />
                  </View>
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerCaption}>Окончание</Text>
                    <Text style={styles.dateValue}>{formatDay(endDay)}</Text>
                  </View>
                  <PoraIcon
                    color={theme.muted}
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
                  <PoraIcon color={theme.danger} name="close" size={20} />
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
                <PoraIcon color={theme.primaryInk} name="calendar-plus" size={20} />
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
            <PoraIcon color={theme.danger} name="alert-circle-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom) }]}>
        <Pressable
          accessibilityLabel={course ? 'Сохранить изменения' : 'Сохранить курс'}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: theme.primaryInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  title: {
    color: theme.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  notice: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    padding: 16,
    gap: 14,
  },
  cardTitle: {
    color: theme.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800' as const,
  },
  field: {
    gap: 6,
  },
  label: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.ink,
    backgroundColor: theme.surfaceAlt,
    fontSize: 16,
  },
  helper: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  catalogHintRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: -6,
  },
  catalogHint: {
    flexShrink: 1,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -6,
  },
  suggestions: {
    marginTop: -4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surfaceAlt,
    overflow: 'hidden' as const,
  },
  suggestionsTitle: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    color: theme.primaryInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  suggestionsEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  suggestion: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 0,
  },
  suggestionName: {
    color: theme.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
  },
  suggestionMeta: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionsMore: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: theme.primarySoft,
  },
  badgeText: {
    color: theme.primaryInk,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  source: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  selected: {
    marginTop: -4,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.primarySoft,
  },
  selectedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  selectedCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: theme.primaryInk,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800' as const,
  },
  selectedMeta: {
    color: theme.ink,
    fontSize: 12,
    lineHeight: 16,
  },
  selectedClear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: -4,
  },
  chip: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surfaceAlt,
  },
  chipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primarySoft,
  },
  chipText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  chipTextActive: {
    color: theme.primaryInk,
    fontWeight: '800' as const,
  },
  scheduleHint: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  pickerGroup: {
    gap: 10,
  },
  timeList: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  pickerButton: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  timePickerButton: {
    flex: 1,
  },
  pickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primarySoft,
  },
  pickerCopy: {
    flex: 1,
    minWidth: 0,
  },
  pickerCaption: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  timeValue: {
    color: theme.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  dateValue: {
    color: theme.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800' as const,
  },
  removeTimeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.dangerSoft,
  },
  addTimeButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
  },
  addTimeText: {
    color: theme.primaryInk,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: theme.line,
  },
  optionalDateButton: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: theme.line,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  optionalDateTitle: {
    color: theme.primaryInk,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800' as const,
  },
  inlinePicker: {
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingTop: 8,
  },
  pickerDoneButton: {
    alignSelf: 'flex-end' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerDoneText: {
    color: theme.primaryInk,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  errorBox: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.dangerSoft,
  },
  errorText: {
    flex: 1,
    color: theme.danger,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700' as const,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.bg,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  saveButtonDisabled: {
    opacity: 0.62,
  },
  saveText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});
