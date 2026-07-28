import { toLocalDayKey } from '../domain/localDay';
import type { MedicationEvent, MedicationPlanItem } from '../domain/medicationDay';

export const demoMedicationPlan: MedicationPlanItem[] = [
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

export function createDemoMedicationEvents(now: Date): MedicationEvent[] {
  const takenAt = new Date(now);
  takenAt.setHours(7, 34, 0, 0);
  return [
    {
      id: `demo-vitamin-taken-${toLocalDayKey(now)}`,
      type: 'taken',
      doseId: 'vitamin-d3-0730',
      dayKey: toLocalDayKey(now),
      recordedAt: takenAt.toISOString(),
    },
  ];
}
