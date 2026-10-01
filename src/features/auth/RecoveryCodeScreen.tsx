import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { radius, useStyles, type Theme } from '../../ui/theme';

interface RecoveryCodeScreenProps {
  code: string;
  onDone: () => void;
}

export function RecoveryCodeScreen({ code, onDone }: RecoveryCodeScreenProps) {
  const styles = useStyles(createStyles);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>пора</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ВАЖНО</Text>
        </View>
        <Text style={styles.title}>Сохраните recovery code</Text>
        <Text style={styles.lead}>
          Он понадобится, если вы забудете пароль. Сервер хранит только hash кода и не
          сможет показать его снова.
        </Text>

        <View style={styles.codeCard}>
          <Text selectable style={styles.code}>
            {code}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Скопировать recovery code"
            onPress={() => void copyCode()}
            style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
          >
            <Text style={styles.copyText}>{copied ? 'Скопировано' : 'Скопировать'}</Text>
          </Pressable>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Как сохранить</Text>
          <Text style={styles.tipText}>
            Добавьте код в менеджер паролей или сохраните снимок этого экрана в защищенном
            месте. Не отправляйте код посторонним.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Я сохранил код"
          onPress={onDone}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>Я сохранил код</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: {
    minHeight: 76,
    paddingTop: 14,
    paddingHorizontal: 22,
    justifyContent: 'center' as const,
  },
  wordmark: {
    color: theme.primaryInk,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  content: { padding: 22, paddingBottom: 40 },
  badge: {
    alignSelf: 'flex-start' as const,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.warningSoft,
    marginBottom: 14,
  },
  badgeText: { color: theme.warning, fontSize: 12, fontWeight: '800' as const, letterSpacing: 1 },
  title: {
    color: theme.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800' as const,
    letterSpacing: -1,
    marginBottom: 10,
  },
  lead: { color: theme.muted, fontSize: 15, lineHeight: 22, marginBottom: 22 },
  codeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 18,
    backgroundColor: theme.surface,
    marginBottom: 16,
  },
  code: {
    color: theme.primaryInk,
    fontFamily: 'monospace',
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textAlign: 'center' as const,
    marginVertical: 12,
  },
  copyButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primarySoft,
  },
  copyText: { color: theme.primaryInk, fontSize: 15, fontWeight: '800' as const },
  tipCard: {
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: theme.warningSoft,
    marginBottom: 22,
  },
  tipTitle: { color: theme.warning, fontSize: 14, lineHeight: 19, fontWeight: '800' as const, marginBottom: 6 },
  tipText: { color: theme.ink, fontSize: 14, lineHeight: 20 },
  doneButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  doneText: { color: theme.onPrimary, fontSize: 16, fontWeight: '800' as const },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
