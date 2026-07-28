import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import { CabinetScreen } from './CabinetScreen';

const course: MedicationCourse = {
  id: 'course-1',
  medicationId: 'med-1',
  medicationName: 'Телмисартан',
  strength: '40 мг',
  dose: '1 таблетка',
  foodRelation: 'после завтрака',
  startDay: '2026-07-28',
  endDay: null,
  isPaused: false,
  scheduledTimes: [{ id: 'time-1', scheduledMinutes: 540 }],
  stockQuantity: 4,
  stockUnit: 'таблеток',
  lowStockThreshold: 5,
  createdAt: '2026-07-28T06:00:00.000Z',
  updatedAt: '2026-07-28T06:00:00.000Z',
};

describe('CabinetScreen', () => {
  it('shows course status and exposes edit, pause and stock actions', async () => {
    const onEdit = jest.fn();
    const onTogglePause = jest.fn();
    const onChangeStock = jest.fn();
    const view = await render(
      <CabinetScreen
        courses={[course]}
        onAdd={jest.fn()}
        onChangeStock={onChangeStock}
        onDelete={jest.fn()}
        onEdit={onEdit}
        onTogglePause={onTogglePause}
      />,
    );

    expect(view.getByText('Мало: 4 таблеток')).toBeTruthy();
    await fireEvent.press(
      view.getByRole('button', { name: 'Приостановить курс Телмисартан' }),
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Изменить курс Телмисартан' }),
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Уменьшить остаток Телмисартан' }),
    );

    expect(onTogglePause).toHaveBeenCalledWith(course);
    expect(onEdit).toHaveBeenCalledWith(course);
    expect(onChangeStock).toHaveBeenCalledWith(course, 3);
  });
});
