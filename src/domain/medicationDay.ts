export type DoseStatus = 'taken' | 'skipped' | 'due' | 'postponed' | 'upcoming';

export interface MedicationPlanItem {
  id: string;
  medicationName: string;
  strength?: string;
  dose: string;
  scheduledMinutes: number;
  foodRelation?: string;
}

export interface MedicationEventSnapshot {
  medicationName?: string;
  strength?: string;
  dose?: string;
}

export interface TakenMedicationEvent extends MedicationEventSnapshot {
  id: string;
  type: 'taken';
  doseId: string;
  dayKey?: string;
  recordedAt: string;
}

export interface PostponedMedicationEvent extends MedicationEventSnapshot {
  id: string;
  type: 'postponed';
  doseId: string;
  dayKey?: string;
  recordedAt: string;
  minutes: number;
}

export interface SkippedMedicationEvent extends MedicationEventSnapshot {
  id: string;
  type: 'skipped';
  doseId: string;
  dayKey?: string;
  recordedAt: string;
}

export interface UndoneMedicationEvent {
  id: string;
  type: 'undone';
  targetEventId: string;
  dayKey?: string;
  recordedAt: string;
}

export type MedicationEvent =
  | TakenMedicationEvent
  | SkippedMedicationEvent
  | PostponedMedicationEvent
  | UndoneMedicationEvent;

export interface MedicationDoseProjection extends MedicationPlanItem {
  displayMinutes: number;
  status: DoseStatus;
}

export interface MedicationDayProjection {
  completedCount: number;
  skippedCount: number;
  doses: MedicationDoseProjection[];
  nextDose?: MedicationDoseProjection;
}

export function projectMedicationDay(
  plan: MedicationPlanItem[],
  events: MedicationEvent[],
  dayKey?: string,
): MedicationDayProjection {
  const scopedEvents = dayKey
    ? events.filter((event) => !event.dayKey || event.dayKey === dayKey)
    : events;
  const undoneEventIds = new Set(
    scopedEvents
      .filter((event): event is UndoneMedicationEvent => event.type === 'undone')
      .map(({ targetEventId }) => targetEventId),
  );
  const activeEvents = scopedEvents.filter(
    (
      event,
    ): event is
      | TakenMedicationEvent
      | SkippedMedicationEvent
      | PostponedMedicationEvent =>
      event.type !== 'undone' && !undoneEventIds.has(event.id),
  );
  const terminalStatusByDose = new Map<string, 'taken' | 'skipped'>();
  const postponedMinutesByDose = new Map<string, number>();
  for (const event of activeEvents) {
    if (event.type === 'taken' || event.type === 'skipped') {
      terminalStatusByDose.set(event.doseId, event.type);
    } else {
      postponedMinutesByDose.set(
        event.doseId,
        (postponedMinutesByDose.get(event.doseId) ?? 0) + event.minutes,
      );
    }
  }
  let dueAssigned = false;

  const doses = plan.map((item) => {
    const terminalStatus = terminalStatusByDose.get(item.id);
    const postponedMinutes = postponedMinutesByDose.get(item.id) ?? 0;
    const status: DoseStatus = terminalStatus
      ? terminalStatus
      : postponedMinutes > 0
        ? 'postponed'
        : !dueAssigned
          ? 'due'
          : 'upcoming';

    if (!terminalStatus && !dueAssigned) {
      dueAssigned = true;
    }

    return {
      ...item,
      displayMinutes: item.scheduledMinutes + postponedMinutes,
      status,
    };
  });
  const completedCount = doses.filter(({ status }) => status === 'taken').length;
  const skippedCount = doses.filter(({ status }) => status === 'skipped').length;

  return {
    completedCount,
    skippedCount,
    doses,
    nextDose: doses.find(({ status }) => status === 'due' || status === 'postponed'),
  };
}
