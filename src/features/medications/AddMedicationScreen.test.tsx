import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AddMedicationScreen } from './AddMedicationScreen';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'native-date-time-picker',
      }),
  };
});

describe('AddMedicationScreen', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
  });

  it('submits times and dates selected through wheel pickers', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const view = await render(
      <AddMedicationScreen
        now={() => new Date(2026, 6, 28, 9, 0)}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('Например, Телмисартан'),
      'Телмисартан',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Например, 40 мг'),
      '40 мг',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Например, 1 таблетка'),
      '1 таблетка',
    );
    expect(view.queryByPlaceholderText('09:00')).toBeNull();
    expect(view.queryByPlaceholderText('2026-07-28')).toBeNull();

    await fireEvent.press(
      view.getByRole('button', { name: 'Выбрать время: 09:00' }),
    );
    let picker = view.getByTestId('native-date-time-picker');
    expect(picker.props.mode).toBe('time');
    expect(picker.props.display).toBe('spinner');
    expect(picker.props.is24Hour).toBe(true);
    await fireEvent(
      picker,
      'valueChange',
      { nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2026, 6, 28, 8, 30),
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Добавить время приема' }),
    );
    picker = view.getByTestId('native-date-time-picker');
    await fireEvent(
      picker,
      'valueChange',
      { nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2026, 6, 28, 21, 15),
    );

    await fireEvent.press(
      view.getByRole('button', {
        name: 'Выбрать дату начала: 2026-07-28',
      }),
    );
    picker = view.getByTestId('native-date-time-picker');
    expect(picker.props.mode).toBe('date');
    expect(picker.props.display).toBe('spinner');
    await fireEvent(
      picker,
      'valueChange',
      { nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2026, 7, 2, 12, 0),
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Добавить дату окончания' }),
    );
    picker = view.getByTestId('native-date-time-picker');
    await fireEvent(
      picker,
      'valueChange',
      { nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2026, 7, 31, 12, 0),
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Например, 28'),
      '28',
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Сохранить курс' }),
    );

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationName: 'Телмисартан',
          strength: '40 мг',
          dose: '1 таблетка',
          startDay: '2026-08-02',
          endDay: '2026-08-31',
          scheduledMinutes: [510, 1275],
          stockQuantity: 28,
        }),
      ),
    );
  });

  it('does not keep a suggested time when adding is cancelled', async () => {
    const view = await render(
      <AddMedicationScreen
        now={() => new Date(2026, 6, 28, 9, 0)}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Добавить время приема' }),
    );
    const picker = view.getByTestId('native-date-time-picker');
    await fireEvent(picker, 'dismiss');

    expect(
      view.queryByRole('button', { name: 'Выбрать время: 21:00' }),
    ).toBeNull();
    expect(view.queryByRole('button', { name: 'Удалить время: 09:00' })).toBeNull();
  });
});
