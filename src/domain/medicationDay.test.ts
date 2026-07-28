import { projectMedicationDay, type MedicationPlanItem } from './medicationDay';

const plan: MedicationPlanItem[] = [
  {
    id: 'vitamin-d3-0730',
    medicationName: 'Витамин D3',
    dose: '1 капсула',
    scheduledMinutes: 7 * 60 + 30,
    foodRelation: 'после еды',
  },
  {
    id: 'telmisartan-0900',
    medicationName: 'Телмисартан',
    strength: '40 мг',
    dose: '1 таблетка',
    scheduledMinutes: 9 * 60,
    foodRelation: 'после завтрака',
  },
  {
    id: 'magnesium-2100',
    medicationName: 'Магний цитрат',
    dose: '2 капсулы',
    scheduledMinutes: 21 * 60,
    foodRelation: 'с едой',
  },
];

describe('projectMedicationDay', () => {
  it('marks the first unfinished dose as due and the rest as upcoming', () => {
    const day = projectMedicationDay(plan, []);

    expect(day.completedCount).toBe(0);
    expect(day.doses.map(({ status }) => status)).toEqual([
      'due',
      'upcoming',
      'upcoming',
    ]);
    expect(day.nextDose?.id).toBe('vitamin-d3-0730');
  });

  it('records a taken dose and advances the due state to the next dose', () => {
    const day = projectMedicationDay(plan, [
      {
        id: 'event-taken-vitamin',
        type: 'taken',
        doseId: 'vitamin-d3-0730',
        recordedAt: '2026-07-28T07:34:00.000Z',
      },
    ]);

    expect(day.completedCount).toBe(1);
    expect(day.doses.map(({ status }) => status)).toEqual([
      'taken',
      'due',
      'upcoming',
    ]);
    expect(day.nextDose?.id).toBe('telmisartan-0900');
  });

  it('postpones the current dose without changing its prescribed time', () => {
    const day = projectMedicationDay(plan, [
      {
        id: 'event-taken-vitamin',
        type: 'taken',
        doseId: 'vitamin-d3-0730',
        recordedAt: '2026-07-28T07:34:00.000Z',
      },
      {
        id: 'event-postpone-telmisartan',
        type: 'postponed',
        doseId: 'telmisartan-0900',
        recordedAt: '2026-07-28T09:02:00.000Z',
        minutes: 10,
      },
    ]);

    expect(day.doses[1]).toMatchObject({
      scheduledMinutes: 9 * 60,
      displayMinutes: 9 * 60 + 10,
      status: 'postponed',
    });
    expect(day.nextDose?.id).toBe('telmisartan-0900');
  });

  it('skips a dose without counting it as taken and advances to the next dose', () => {
    const day = projectMedicationDay(plan, [
      {
        id: 'event-skip-vitamin',
        type: 'skipped',
        doseId: 'vitamin-d3-0730',
        recordedAt: '2026-07-28T07:45:00.000Z',
      },
    ]);

    expect(day.completedCount).toBe(0);
    expect(day.skippedCount).toBe(1);
    expect(day.doses.map(({ status }) => status)).toEqual([
      'skipped',
      'due',
      'upcoming',
    ]);
    expect(day.nextDose?.id).toBe('telmisartan-0900');
  });

  it('undoes a previously recorded action without deleting the history event', () => {
    const day = projectMedicationDay(plan, [
      {
        id: 'event-taken-vitamin',
        type: 'taken',
        doseId: 'vitamin-d3-0730',
        recordedAt: '2026-07-28T07:34:00.000Z',
      },
      {
        id: 'event-undo-vitamin',
        type: 'undone',
        targetEventId: 'event-taken-vitamin',
        recordedAt: '2026-07-28T07:35:00.000Z',
      },
    ]);

    expect(day.completedCount).toBe(0);
    expect(day.doses[0].status).toBe('due');
    expect(day.nextDose?.id).toBe('vitamin-d3-0730');
  });

  it('does not carry yesterday’s intake state into a new local day', () => {
    const day = projectMedicationDay(
      plan,
      [
        {
          id: 'event-taken-yesterday',
          type: 'taken',
          doseId: 'vitamin-d3-0730',
          dayKey: '2026-07-27',
          recordedAt: '2026-07-27T07:34:00.000Z',
        },
      ],
      '2026-07-28',
    );

    expect(day.completedCount).toBe(0);
    expect(day.nextDose?.id).toBe('vitamin-d3-0730');
  });
});
