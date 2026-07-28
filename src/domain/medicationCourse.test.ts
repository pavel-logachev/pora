import {
  normalizeCourseInput,
  parseTimeList,
  projectPlanFromCourses,
  type MedicationCourse,
} from './medicationCourse';

describe('medication course', () => {
  it('parses a comma-separated list of prescribed local times', () => {
    expect(parseTimeList('09:00, 21:30')).toEqual([540, 1290]);
    expect(() => parseTimeList('09:75')).toThrow('Проверьте время приема');
  });

  it('normalizes a new course and removes duplicate times', () => {
    const normalized = normalizeCourseInput({
      medicationName: '  Телмисартан  ',
      strength: ' 40 мг ',
      dose: ' 1 таблетка ',
      foodRelation: ' после завтрака ',
      startDay: '2026-07-28',
      endDay: null,
      scheduledMinutes: [21 * 60, 9 * 60, 9 * 60],
      stockQuantity: 28,
      stockUnit: ' таблеток ',
      lowStockThreshold: 5,
    });

    expect(normalized).toEqual({
      medicationName: 'Телмисартан',
      strength: '40 мг',
      dose: '1 таблетка',
      foodRelation: 'после завтрака',
      startDay: '2026-07-28',
      endDay: null,
      scheduledMinutes: [9 * 60, 21 * 60],
      stockQuantity: 28,
      stockUnit: 'таблеток',
      lowStockThreshold: 5,
    });
  });

  it('projects only active, unpaused courses for the selected local day', () => {
    const courses: MedicationCourse[] = [
      {
        id: 'course-active',
        medicationId: 'med-active',
        medicationName: 'Телмисартан',
        strength: '40 мг',
        dose: '1 таблетка',
        foodRelation: 'после завтрака',
        startDay: '2026-07-20',
        endDay: '2026-08-20',
        isPaused: false,
        scheduledTimes: [{ id: 'time-0900', scheduledMinutes: 540 }],
        stockQuantity: 20,
        stockUnit: 'таблеток',
        lowStockThreshold: 5,
        createdAt: '2026-07-20T06:00:00.000Z',
        updatedAt: '2026-07-20T06:00:00.000Z',
      },
      {
        id: 'course-paused',
        medicationId: 'med-paused',
        medicationName: 'Магний',
        dose: '2 капсулы',
        startDay: '2026-07-20',
        endDay: null,
        isPaused: true,
        scheduledTimes: [{ id: 'time-2100', scheduledMinutes: 1260 }],
        stockQuantity: null,
        stockUnit: null,
        lowStockThreshold: null,
        createdAt: '2026-07-20T06:00:00.000Z',
        updatedAt: '2026-07-20T06:00:00.000Z',
      },
    ];

    expect(projectPlanFromCourses(courses, '2026-07-28')).toEqual([
      {
        id: 'time-0900',
        medicationName: 'Телмисартан',
        strength: '40 мг',
        dose: '1 таблетка',
        foodRelation: 'после завтрака',
        scheduledMinutes: 540,
      },
    ]);
  });
});
