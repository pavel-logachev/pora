import { buildWeekView } from './localDay';

describe('buildWeekView', () => {
  it('builds the current Monday-to-Sunday week in local time', () => {
    const week = buildWeekView(new Date(2026, 6, 28, 12));

    expect(week.label).toBe('ИЮЛЬ · НЕДЕЛЯ 31');
    expect(week.days.map(({ date }) => date)).toEqual([27, 28, 29, 30, 31, 1, 2]);
    expect(week.days.map(({ isToday }) => isToday)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
