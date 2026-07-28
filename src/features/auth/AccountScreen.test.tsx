import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AccountScreen } from './AccountScreen';

describe('AccountScreen', () => {
  it('shows account and exposes sync and session controls', async () => {
    const onSync = jest.fn(async () => undefined);
    const onLogout = jest.fn(async () => undefined);
    const view = await render(
      <AccountScreen
        onBack={jest.fn()}
        onDelete={jest.fn(async () => undefined)}
        onLogout={onLogout}
        onSync={onSync}
        syncStatus="synced"
        user={{
          id: 'user-1',
          email: 'friend@example.com',
          displayName: 'Друг',
          createdAt: '2026-07-28T00:00:00.000Z',
        }}
      />,
    );

    expect(view.getByText('friend@example.com')).toBeTruthy();
    expect(view.getByText('Данные синхронизированы')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Синхронизировать сейчас' }));
    await fireEvent.press(view.getByRole('button', { name: 'Выйти из аккаунта' }));
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
