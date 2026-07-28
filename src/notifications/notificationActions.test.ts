import {
  notificationActionPostponed,
  notificationActionTaken,
} from './notificationConstants';
import { notificationResponseToAction } from './notificationActions';

const response = {
  actionIdentifier: notificationActionTaken,
  notification: {
    date: new Date(2026, 6, 28, 9, 0, 0).getTime(),
    request: {
      identifier: 'pora:course-1:time-9:daily',
      content: {
        body: 'Телмисартан 40 мг · 1 таблетка',
        data: {
          source: 'pora-medication-reminder',
          courseId: 'course-1',
          doseId: 'time-9',
          scheduledMinutes: 540,
        },
      },
    },
  },
};

describe('notification actions', () => {
  it('creates an idempotent taken event scoped to the delivered local day', () => {
    const first = notificationResponseToAction(
      response,
      new Date(2026, 6, 28, 9, 2, 0),
    );
    const second = notificationResponseToAction(
      response,
      new Date(2026, 6, 28, 9, 3, 0),
    );

    expect(first?.event).toMatchObject({
      id: 'notification:pora:course-1:time-9:daily:PORA_TAKEN',
      type: 'taken',
      doseId: 'time-9',
      dayKey: '2026-07-28',
    });
    expect(first?.notificationIdentifier).toBe('pora:course-1:time-9:daily');
    expect(second?.event.id).toBe(first?.event.id);
  });

  it('creates a ten-minute postpone event and a snooze request', () => {
    const action = notificationResponseToAction(
      { ...response, actionIdentifier: notificationActionPostponed },
      new Date(2026, 6, 28, 23, 55, 0),
    );

    expect(action?.event).toMatchObject({
      type: 'postponed',
      minutes: 10,
    });
    expect(action?.snooze?.date).toEqual(new Date(2026, 6, 29, 0, 5, 0));
  });
});
