import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import { AddMedicationScreen, type AddMedicationScreenProps } from './AddMedicationScreen';

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, { ...props, testID: 'native-date-time-picker' }),
  };
});

const item = {
  catalogVersion: 'esklp-2026-07-29-schema-21.5',
  sourceUuid: '11111111-2222-3333-4444-555555555555',
  sourceCode: '21.20.10.221-000010-1-00174-2000001505218',
  tradeName: 'Нурофен Экспресс',
  inn: 'ИБУПРОФЕН',
  dosage: '200 мг',
  form: 'КАПСУЛЫ',
  registrationNumber: 'ЛП-№(010639)-(РГ-RU)',
  manufacturer: 'ПАТЕОН СОФТДЖЕЛС Б.В.',
  isZnvlp: true,
};

const nameInput = 'Например, Телмисартан';

async function renderForm(overrides: Partial<AddMedicationScreenProps> = {}) {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const searchCatalog = jest.fn().mockResolvedValue([item]);
  const view = await render(
    <AddMedicationScreen
      catalogInitializationState="ready"
      now={() => new Date(2026, 6, 28, 9, 0)}
      onCancel={jest.fn()}
      onSave={onSave}
      searchCatalog={searchCatalog}
      {...overrides}
    />,
  );
  return { view, onSave, searchCatalog };
}

describe('AddMedicationScreen with the ЕСКЛП directory', () => {
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  it('suggests medicines while the name is typed and fills the course from the choice', async () => {
    const { view, onSave, searchCatalog } = await renderForm();

    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'нуроф');

    const suggestion = await view.findByRole('button', {
      name: 'Выбрать лекарство: Нурофен Экспресс, 200 мг, Капсулы',
    });
    expect(searchCatalog).toHaveBeenCalledWith('нуроф');
    expect(view.getByText('Подсказки ЕСКЛП')).toBeTruthy();
    expect(view.getByText('ЖНВЛП')).toBeTruthy();
    expect(view.getByText(/Источник: ЕСКЛП Минздрава России · 29\.07\.2026/)).toBeTruthy();

    await fireEvent.press(suggestion);

    expect(view.getByDisplayValue('Нурофен Экспресс')).toBeTruthy();
    expect(view.getByDisplayValue('200 мг')).toBeTruthy();
    expect(view.getByDisplayValue('1 капсула')).toBeTruthy();
    expect(view.getByDisplayValue('капсул')).toBeTruthy();
    expect(view.getByText('Из справочника ЕСКЛП')).toBeTruthy();
    expect(view.queryByText('Подсказки ЕСКЛП')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Сохранить курс' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationName: 'Нурофен Экспресс',
          strength: '200 мг',
          form: 'Капсулы',
          dose: '1 капсула',
          catalogSource: 'esklp',
          catalogVersion: 'esklp-2026-07-29-schema-21.5',
          catalogItemUuid: item.sourceUuid,
          catalogItemCode: item.sourceCode,
          inn: 'ИБУПРОФЕН',
          registrationNumber: item.registrationNumber,
          manufacturer: item.manufacturer,
        }),
      ),
    );
  });

  it('keeps a dose the person already wrote', async () => {
    const { view } = await renderForm();
    await fireEvent.changeText(view.getByPlaceholderText('Например, 1 таблетка'), '2 капсулы');
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'нуроф');

    await fireEvent.press(await view.findByRole('button', { name: /Выбрать лекарство: Нурофен/ }));

    expect(view.getByDisplayValue('2 капсулы')).toBeTruthy();
  });

  it('drops the directory reference when the name is edited by hand', async () => {
    const { view, onSave } = await renderForm();
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'нуроф');
    await fireEvent.press(await view.findByRole('button', { name: /Выбрать лекарство: Нурофен/ }));
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'Нурофен мой');

    expect(view.queryByText('Из справочника ЕСКЛП')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить курс' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(saved.medicationName).toBe('Нурофен мой');
    expect(saved.catalogItemUuid).toBeUndefined();
    expect(saved.inn).toBeUndefined();
    expect(saved.form).toBeUndefined();
  });

  it('lets the person drop a chosen entry and keep the typed name', async () => {
    const { view } = await renderForm();
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'нуроф');
    await fireEvent.press(await view.findByRole('button', { name: /Выбрать лекарство: Нурофен/ }));

    await fireEvent.press(
      view.getByRole('button', { name: 'Не использовать подсказку из справочника' }),
    );

    expect(view.queryByText('Из справочника ЕСКЛП')).toBeNull();
    expect(view.getByDisplayValue('Нурофен Экспресс')).toBeTruthy();
  });

  it('says so when nothing is found', async () => {
    const { view } = await renderForm({ searchCatalog: jest.fn().mockResolvedValue([]) });
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'зззз');

    expect(
      await view.findByText('В ЕСКЛП ничего не найдено. Название можно оставить вручную.'),
    ).toBeTruthy();
  });

  it('survives a failing search', async () => {
    const { view } = await renderForm({ searchCatalog: jest.fn().mockRejectedValue(new Error('boom')) });
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'нуроф');

    expect(
      await view.findByText('В ЕСКЛП ничего не найдено. Название можно оставить вручную.'),
    ).toBeTruthy();
  });

  it('does not search for a one-letter name', async () => {
    const { view, searchCatalog } = await renderForm();
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'н');

    expect(searchCatalog).not.toHaveBeenCalled();
    expect(view.queryByText('Подсказки ЕСКЛП')).toBeNull();
  });

  it('says the directory is being connected while it opens', async () => {
    const view = await render(
      <AddMedicationScreen
        catalogInitializationState="loading"
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(await view.findByText('Подключаем справочник ЕСКЛП…')).toBeTruthy();
  });

  it('keeps manual entry working when the directory is unavailable', async () => {
    const view = await render(
      <AddMedicationScreen
        catalogInitializationState="unavailable"
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(
      await view.findByText('Справочник ЕСКЛП не открылся. Название можно ввести вручную.'),
    ).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'Что-то');
    expect(view.queryByText('Подсказки ЕСКЛП')).toBeNull();
  });

  it('offers the usual food relations as one tap', async () => {
    const { view, onSave } = await renderForm();
    await fireEvent.changeText(view.getByPlaceholderText(nameInput), 'Вручную');
    await fireEvent.changeText(view.getByPlaceholderText('Например, 1 таблетка'), '1 таблетка');

    await fireEvent.press(view.getByRole('button', { name: 'Связь с едой: после еды' }));
    expect(view.getByDisplayValue('после еды')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить курс' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ foodRelation: 'после еды' })),
    );
  });

  it('shows the directory entry of a course that is being edited', async () => {
    const course: MedicationCourse = {
      id: 'course-1',
      medicationId: 'medication-1',
      medicationName: 'Нурофен Экспресс',
      strength: '200 мг',
      form: 'Капсулы',
      catalogSource: 'esklp',
      catalogVersion: item.catalogVersion,
      catalogItemUuid: item.sourceUuid,
      catalogItemCode: item.sourceCode,
      inn: 'ИБУПРОФЕН',
      manufacturer: item.manufacturer,
      dose: '1 капсула',
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
    const { view, onSave } = await renderForm({ course });

    expect(view.getByText('Из справочника ЕСКЛП')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ catalogItemUuid: item.sourceUuid, form: 'Капсулы' }),
      ),
    );
  });
});
