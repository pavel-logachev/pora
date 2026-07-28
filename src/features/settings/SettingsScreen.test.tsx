import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  it('shows guest and notification status and exposes setup actions', async () => {
    const onOpenAccount = jest.fn();
    const onConfigureNotifications = jest.fn();
    const view = await render(
      <SettingsScreen
        accountEmail={null}
        notificationStatus="not-determined"
        onBack={jest.fn()}
        onConfigureNotifications={onConfigureNotifications}
        onExport={jest.fn()}
        onOpenAccount={onOpenAccount}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
      />,
    );

    expect(view.getByText('Без аккаунта')).toBeTruthy();
    expect(view.getByText('Нужно разрешение')).toBeTruthy();

    await fireEvent.press(
      view.getByRole('button', { name: 'Настроить аккаунт и синхронизацию' }),
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Настроить уведомления' }),
    );

    expect(onOpenAccount).toHaveBeenCalledTimes(1);
    expect(onConfigureNotifications).toHaveBeenCalledTimes(1);
  });
});
