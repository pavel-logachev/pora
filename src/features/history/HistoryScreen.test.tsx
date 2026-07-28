import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import type { MedicationEvent } from '../../domain/medicationDay';
import { HistoryScreen } from './HistoryScreen';

const course: MedicationCourse = {
  id: 'course-1',
  medicationId: 'med-1',
  medicationName: 'Телмисартан',
  strength: '40 мг',
  dose: '1 таблетка',
  startDay: '2026-07-28',
  endDay: null,
  isPaused: false,
  scheduledTimes: [{ id: 'time-1', scheduledMinutes: 540 }],
  stockQuantity: null,
  stockUnit: null,
  lowStockThreshold: null,
  createdAt: '2026-07-28T06:00:00.000Z',
  updatedAt: '2026-07-28T06:00:00.000Z',
};

const events: MedicationEvent[] = [
  {
    id: 'taken-1',
    type: 'taken',
    doseId: 'time-1',
    dayKey: '2026-07-28',
    recordedAt: '2026-07-28T06:05:00.000Z',
  },
  {
    id: 'skipped-1',
    type: 'skipped',
    doseId: 'time-1',
    dayKey: '2026-07-29',
    recordedAt: '2026-07-29T06:05:00.000Z',
  },
];

describe('HistoryScreen', () => {
  it('shows recorded intake outcomes and exports them', async () => {
    const onExport = jest.fn();
    const view = await render(
      <HistoryScreen courses={[course]} events={events} onExport={onExport} />,
    );

    expect(view.getAllByText('Телмисартан 40 мг')).toHaveLength(2);
    expect(view.getByText('Принято')).toBeTruthy();
    expect(view.getByText('Пропущено')).toBeTruthy();

    await fireEvent.press(
      view.getByRole('button', { name: 'Экспортировать историю' }),
    );
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
