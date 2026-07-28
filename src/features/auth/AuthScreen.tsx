import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PoraIcon } from '../../ui/PoraIcon';

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

const colors = {
  blue: '#4658D9',
  blueDark: '#3344BF',
  blueSoft: '#E9EDFF',
  paper: '#FFFFFF',
  mist: '#F3F5FB',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  danger: '#9E4038',
};

export function AuthScreen({ onCancel, onSubmit }: AuthScreenProps) {
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
            <PoraIcon color={colors.paper} name="arrow-left" size={24} />
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
                placeholderTextColor="#9AA1B4"
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
              placeholderTextColor="#9AA1B4"
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
                  placeholderTextColor="#9AA1B4"
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
              placeholderTextColor="#9AA1B4"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  content: { paddingBottom: 36 },
  header: {
    minHeight: 88,
    paddingTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  wordmark: {
    marginLeft: 14,
    color: colors.paper,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  intro: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 21 },
  eyebrow: {
    color: colors.blue,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    marginBottom: 10,
  },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  form: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 17,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fieldGroup: { marginBottom: 15 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  input: {
    minHeight: 52,
    borderRadius: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAFBFE',
    color: colors.ink,
    fontSize: 15,
  },
  recoveryInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  passwordLabel: { marginTop: 14 },
  errorCard: {
    marginBottom: 14,
    borderRadius: 13,
    padding: 11,
    backgroundColor: '#FDECE9',
  },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  primaryButton: {
    minHeight: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  primaryText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  switchButton: { minHeight: 45, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: colors.blueDark, fontSize: 12, fontWeight: '800' },
  privacyCard: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 15,
    backgroundColor: colors.blueSoft,
  },
  privacyTitle: { color: colors.blueDark, fontSize: 12, fontWeight: '900', marginBottom: 5 },
  privacyText: { color: '#58638A', fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
