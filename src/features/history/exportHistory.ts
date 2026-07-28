import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { MedicationCourse } from '../../domain/medicationCourse';
import type { MedicationEvent } from '../../domain/medicationDay';
import { buildHistoryRows } from './HistoryScreen';

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildHistoryCsv(
  courses: MedicationCourse[],
  events: MedicationEvent[],
) {
  const header = ['Дата', 'Время записи', 'Лекарство', 'Назначение', 'Действие'];
  const rows = buildHistoryRows(courses, events).map((row) => [
    row.dayKey,
    row.recordedTime,
    row.medicationLabel,
    row.detail,
    row.status,
  ]);
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')}\r\n`;
}

export async function shareHistoryCsv(
  courses: MedicationCourse[],
  events: MedicationEvent[],
) {
  const content = buildHistoryCsv(courses, events);
  const fileName = `pora-history-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true, intermediates: true });
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Системный экспорт недоступен на этом устройстве');
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Экспорт истории «Пора»',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
