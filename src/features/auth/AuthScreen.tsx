import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export type AuthMode = 'register' | 'login' | 'recover';

interface AuthScreenProps {
  onCancel: () => void;
  onSubmit: (
    mode: AuthMode,
    email: string,
    password: string,
    displayName?: string,
    recoveryCode?: string,
  ) => Promise<void>;
}

export function AuthScreen({ onCancel, onSubmit }: AuthScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const [mode, setMode] = useState<AuthMode>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    if (!email.trim() || !email.includes('@')) {
      setError('Проверьте адрес электронной почты');
      return;
    }
    if (password.length < 12) {
      setError('Пароль должен содержать не менее 12 символов');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'recover') {
        if (!recoveryCode.trim()) {
          setError('Введите recovery code');
          return;
        }
        await onSubmit(mode, email.trim(), password, undefined, recoveryCode.trim());
      } else {
        await onSubmit(
          mode,
          email.trim(),
          password,
          mode === 'register' && displayName.trim() ? displayName.trim() : undefined,
        );
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Не удалось подключиться к серверу',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Продолжить без аккаунта"
            onPress={onCancel}
            style={styles.backButton}
          >
            <PoraIcon color={theme.ink} name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.wordmark}>пора</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>РЕЗЕРВНАЯ КОПИЯ И СИНХРОНИЗАЦИЯ</Text>
          <Text style={styles.title}>
            {mode === 'register'
              ? 'Создайте аккаунт'
              : mode === 'recover'
                ? 'Задайте новый пароль'
                : 'Войдите в аккаунт'}
          </Text>
          <Text style={styles.lead}>
            {mode === 'recover'
              ? 'Введите recovery code, который был показан после регистрации.'
              : 'Расписание и напоминания работают без аккаунта. Вход нужен для резервной копии и переноса данных.'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Имя (необязательно)</Text>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={setDisplayName}
                placeholder="Как к вам обращаться"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                value={displayName}
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Электронная почта</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            {mode === 'recover' ? (
              <>
                <Text style={styles.label}>Recovery code</Text>
                <TextInput
                  accessibilityLabel="Recovery code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setRecoveryCode}
                  placeholder="Код из экрана регистрации"
                  placeholderTextColor={theme.placeholder}
                  style={[styles.input, styles.recoveryInput]}
                  value={recoveryCode}
                />
              </>
            ) : null}
            <Text style={[styles.label, mode === 'recover' && styles.passwordLabel]}>
              {mode === 'recover' ? 'Новый пароль' : 'Пароль'}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChangeText={setPassword}
              placeholder="Не менее 12 символов"
              placeholderTextColor={theme.placeholder}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'register'
                ? 'Создать аккаунт'
                : mode === 'recover'
                  ? 'Восстановить доступ'
                  : 'Войти'
            }
            disabled={busy}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>
              {busy
                ? 'Подключаем…'
                : mode === 'register'
                  ? 'Создать аккаунт'
                  : mode === 'recover'
                    ? 'Восстановить доступ'
                    : 'Войти'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'register'
                ? 'Уже есть аккаунт — войти'
                : mode === 'recover'
                  ? 'Вернуться ко входу'
                  : 'Создать новый аккаунт'
            }
            onPress={() => {
              setMode((current) =>
                current === 'register' ? 'login' : current === 'recover' ? 'login' : 'register',
              );
              setError(undefined);
            }}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {mode === 'register'
                ? 'Уже есть аккаунт? Войти'
                : mode === 'recover'
                  ? 'Вернуться ко входу'
                  : 'Нет аккаунта? Зарегистрироваться'}
            </Text>
          </Pressable>

          {mode === 'login' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Восстановить доступ"
              onPress={() => {
                setMode('recover');
                setError(undefined);
              }}
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>Забыли пароль?</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Без рекламы и перепродажи данных</Text>
          <Text style={styles.privacyText}>
            Сервер хранит только данные аккаунта и вашу резервную копию. Удалить аккаунт
            вместе с серверной копией можно в настройках.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { paddingBottom: 36 },
  header: {
    minHeight: 76,
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  wordmark: {
    marginLeft: 14,
    color: theme.primaryInk,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  intro: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  eyebrow: {
    color: theme.primaryInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  title: {
    color: theme.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -1,
    marginBottom: 10,
  },
  lead: { color: theme.muted, fontSize: 15, lineHeight: 21 },
  form: {
    marginHorizontal: 16,
    borderRadius: radius.xl,
    padding: 18,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  fieldGroup: { marginBottom: 15 },
  label: { color: theme.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' as const, marginBottom: 7 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surfaceAlt,
    color: theme.ink,
    fontSize: 16,
  },
  recoveryInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  passwordLabel: { marginTop: 14 },
  errorCard: {
    marginBottom: 14,
    borderRadius: 14,
    padding: 12,
    backgroundColor: theme.dangerSoft,
  },
  errorText: { color: theme.danger, fontSize: 14, lineHeight: 19, fontWeight: '700' as const },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  primaryText: { color: theme.onPrimary, fontSize: 16, fontWeight: '800' as const },
  switchButton: { minHeight: 48, alignItems: 'center' as const, justifyContent: 'center' as const },
  switchText: { color: theme.primaryInk, fontSize: 14, fontWeight: '800' as const },
  privacyCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: theme.primarySoft,
  },
  privacyTitle: { color: theme.primaryInk, fontSize: 14, lineHeight: 19, fontWeight: '800' as const, marginBottom: 5 },
  privacyText: { color: theme.ink, fontSize: 13, lineHeight: 19 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
