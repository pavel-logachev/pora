import type { MedicationPlanItem } from './medicationDay';

export interface NewMedicationCourseInput {
  medicationName: string;
  strength?: string;
  dose: string;
  foodRelation?: string;
  startDay: string;
  endDay: string | null;
  scheduledMinutes: number[];
  stockQuantity: number | null;
  stockUnit: string | null;
  lowStockThreshold: number | null;
}

export interface MedicationCourseTime {
  id: string;
  scheduledMinutes: number;
}

export interface MedicationCourse {
  id: string;
  medicationId: string;
  medicationName: string;
  strength?: string;
  dose: string;
  foodRelation?: string;
  startDay: string;
  endDay: string | null;
  isPaused: boolean;
  scheduledTimes: MedicationCourseTime[];
  stockQuantity: number | null;
  stockUnit: string | null;
  lowStockThreshold: number | null;
  createdAt: string;
  updatedAt: string;
}

function optionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function nullableText(value: string | null | undefined): string | null {
  return optionalText(value) ?? null;
}

function assertDayKey(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} должен быть в формате YYYY-MM-DD`);
  }
}

export function parseTimeList(value: string): number[] {
  const tokens = value
    .split(/[;,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('Добавьте хотя бы одно время приема');
  }

  return tokens.map((token) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(token);
    if (!match) throw new Error('Проверьте время приема, например 09:00');
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      throw new Error('Проверьте время приема, например 09:00');
    }
    return hours * 60 + minutes;
  });
}

export function normalizeCourseInput(
  input: NewMedicationCourseInput,
): NewMedicationCourseInput {
  const medicationName = input.medicationName.trim();
  const dose = input.dose.trim();
  const scheduledMinutes = [...new Set(input.scheduledMinutes)].sort(
    (left, right) => left - right,
  );

  if (!medicationName) {
    throw new Error('Укажите название лекарства');
  }
  if (!dose) {
    throw new Error('Укажите дозировку на один прием');
  }
  if (scheduledMinutes.length === 0) {
    throw new Error('Добавьте хотя бы одно время приема');
  }
  if (
    scheduledMinutes.some(
      (minutes) => !Number.isInteger(minutes) || minutes < 0 || minutes > 1439,
    )
  ) {
    throw new Error('Время приема должно находиться в пределах суток');
  }

  assertDayKey(input.startDay, 'Дата начала');
  if (input.endDay) {
    assertDayKey(input.endDay, 'Дата окончания');
    if (input.endDay < input.startDay) {
      throw new Error('Дата окончания не может быть раньше даты начала');
    }
  }

  if (input.stockQuantity !== null && input.stockQuantity < 0) {
    throw new Error('Остаток не может быть отрицательным');
  }
  if (input.lowStockThreshold !== null && input.lowStockThreshold < 0) {
    throw new Error('Порог остатка не может быть отрицательным');
  }

  return {
    medicationName,
    ...(optionalText(input.strength)
      ? { strength: optionalText(input.strength) }
      : {}),
    dose,
    ...(optionalText(input.foodRelation)
      ? { foodRelation: optionalText(input.foodRelation) }
      : {}),
    startDay: input.startDay,
    endDay: input.endDay,
    scheduledMinutes,
    stockQuantity: input.stockQuantity,
    stockUnit: nullableText(input.stockUnit),
    lowStockThreshold: input.lowStockThreshold,
  };
}

export function projectPlanFromCourses(
  courses: MedicationCourse[],
  dayKey: string,
): MedicationPlanItem[] {
  return courses
    .filter(
      (course) =>
        !course.isPaused &&
        course.startDay <= dayKey &&
        (!course.endDay || course.endDay >= dayKey),
    )
    .flatMap((course) =>
      course.scheduledTimes.map((time) => ({
        id: time.id,
        medicationName: course.medicationName,
        ...(course.strength ? { strength: course.strength } : {}),
        dose: course.dose,
        scheduledMinutes: time.scheduledMinutes,
        ...(course.foodRelation
          ? { foodRelation: course.foodRelation }
          : {}),
      })),
    )
    .sort((left, right) => left.scheduledMinutes - right.scheduledMinutes);
}
