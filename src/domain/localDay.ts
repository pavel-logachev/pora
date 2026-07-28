export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface WeekViewDay {
  weekday: string;
  date: number;
  dayKey: string;
  isToday: boolean;
}

export interface WeekView {
  label: string;
  days: WeekViewDay[];
}

const monthNames = [
  'ЯНВАРЬ',
  'ФЕВРАЛЬ',
  'МАРТ',
  'АПРЕЛЬ',
  'МАЙ',
  'ИЮНЬ',
  'ИЮЛЬ',
  'АВГУСТ',
  'СЕНТЯБРЬ',
  'ОКТЯБРЬ',
  'НОЯБРЬ',
  'ДЕКАБРЬ',
];

const weekdayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function getIsoWeekNumber(date: Date): number {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

export function buildWeekView(date: Date): WeekView {
  const todayKey = toLocalDayKey(date);
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const days = weekdayNames.map((weekday, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    const dayKey = toLocalDayKey(day);
    return {
      weekday,
      date: day.getDate(),
      dayKey,
      isToday: dayKey === todayKey,
    };
  });

  return {
    label: `${monthNames[date.getMonth()]} · НЕДЕЛЯ ${getIsoWeekNumber(date)}`,
    days,
  };
}
