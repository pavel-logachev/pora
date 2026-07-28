import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { MedicationEvent, MedicationPlanItem } from '../../domain/medicationDay';
import { TodayScreen } from './TodayScreen';

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

const initialEvents: MedicationEvent[] = [
  {
    id: 'taken-vitamin',
    type: 'taken',
    doseId: 'vitamin-d3-0730',
    recordedAt: '2026-07-28T07:34:00.000Z',
  },
];

describe('TodayScreen', () => {
  it('advances after confirmation and lets the user undo the action', async () => {
    const eventIds = ['taken-telmisartan', 'undo-telmisartan'];
    const onEvent = jest.fn();

    const view = await render(
      <TodayScreen
        plan={plan}
        initialEvents={initialEvents}
        createEventId={() => eventIds.shift() ?? 'unexpected-event'}
        now={() => new Date('2026-07-28T09:02:00.000Z')}
        onEvent={onEvent}
      />,
    );

    expect(view.getByText('Телмисартан 40 мг')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Отметить прием' }));

    expect(view.getAllByText('Магний цитрат')).toHaveLength(2);
    expect(view.getByText('Прием отмечен')).toBeTruthy();

    await fireEvent.press(
      view.getByRole('button', { name: 'Отменить последнее действие' }),
    );

    expect(view.getByText('Телмисартан 40 мг')).toBeTruthy();
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('lets the user skip the current dose without recording it as taken', async () => {
    const onEvent = jest.fn();
    const view = await render(
      <TodayScreen
        plan={plan}
        initialEvents={initialEvents}
        createEventId={() => 'skipped-telmisartan'}
        now={() => new Date('2026-07-28T09:05:00.000Z')}
        onEvent={onEvent}
      />,
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Пропустить этот прием' }),
    );

    expect(view.getAllByText('Магний цитрат')).toHaveLength(2);
    expect(view.getByText('Прием пропущен')).toBeTruthy();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skipped-telmisartan',
        type: 'skipped',
        doseId: 'telmisartan-0900',
      }),
    );
  });

  it('shows an honest empty state that starts medication creation', async () => {
    const onAddMedication = jest.fn();
    const view = await render(
      <TodayScreen
        plan={[]}
        now={() => new Date('2026-07-28T09:05:00.000Z')}
        onAddMedication={onAddMedication}
      />,
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Добавить первое лекарство' }),
    );

    expect(onAddMedication).toHaveBeenCalledTimes(1);
    expect(view.queryByText('ЛОКАЛЬНО И БЕЗ АККАУНТА')).toBeNull();
    expect(view.queryByText('0 из 0 принято')).toBeNull();
  });

  it('reflects an intake recorded from a system notification', async () => {
    const now = () => new Date('2026-07-28T09:05:00.000Z');
    const view = await render(
      <TodayScreen plan={plan} initialEvents={initialEvents} now={now} />,
    );

    await view.rerender(
      <TodayScreen
        plan={plan}
        initialEvents={[
          ...initialEvents,
          {
            id: 'notification-taken',
            type: 'taken',
            doseId: 'telmisartan-0900',
            dayKey: '2026-07-28',
            recordedAt: '2026-07-28T09:04:00.000Z',
          },
        ]}
        now={now}
      />,
    );

    expect(view.getByText('2 из 3 принято')).toBeTruthy();
    expect(view.getAllByText('Магний цитрат')).toHaveLength(2);
  });

  it('labels a missed intake as overdue instead of current', async () => {
    const view = await render(
      <TodayScreen
        plan={plan}
        initialEvents={[]}
        now={() => new Date('2026-07-28T10:45:00')}
      />,
    );

    expect(view.getByText('Просрочено · 07:30')).toBeTruthy();
    expect(view.getByText('Просрочено')).toBeTruthy();
    expect(view.queryByText('Сейчас · до 08:00')).toBeNull();
  });

  it('labels a future intake as next before its current window', async () => {
    const view = await render(
      <TodayScreen
        plan={plan}
        initialEvents={initialEvents}
        now={() => new Date('2026-07-28T08:00:00')}
      />,
    );

    expect(view.getByText('Далее · 09:00')).toBeTruthy();
    expect(view.queryByText('Сейчас')).toBeNull();
    expect(view.getAllByText('Позже')).toHaveLength(2);
  });
});
