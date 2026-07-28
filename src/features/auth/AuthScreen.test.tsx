import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthScreen } from './AuthScreen';

describe('AuthScreen', () => {
  it('registers with email and password while preserving the guest escape path', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const onCancel = jest.fn();
    const view = await render(
      <AuthScreen onCancel={onCancel} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('name@example.com'),
      'friend@example.com',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Не менее 12 символов'),
      'correct-password',
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Создать аккаунт' }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        'register',
        'friend@example.com',
        'correct-password',
        undefined,
      ),
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Продолжить без аккаунта' }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses the recovery code to submit a new password', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const view = await render(
      <AuthScreen onCancel={jest.fn()} onSubmit={onSubmit} />,
    );

    await fireEvent.press(
      view.getByRole('button', { name: 'Уже есть аккаунт — войти' }),
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Восстановить доступ' }),
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('name@example.com'),
      'friend@example.com',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Код из экрана регистрации'),
      'saved-recovery-code-1234',
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Не менее 12 символов'),
      'new-correct-password',
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Восстановить доступ' }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        'recover',
        'friend@example.com',
        'new-correct-password',
        undefined,
        'saved-recovery-code-1234',
      ),
    );
  });
});
