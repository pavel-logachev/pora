import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface RecoveryCodeScreenProps {
  code: string;
  onDone: () => void;
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
  apricot: '#FFD8A8',
};

export function RecoveryCodeScreen({ code, onDone }: RecoveryCodeScreenProps) {
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  header: {
    minHeight: 92,
    paddingTop: 24,
    paddingHorizontal: 22,
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  wordmark: {
    color: colors.paper,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  content: { padding: 22, paddingBottom: 40 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.apricot,
    marginBottom: 14,
  },
  badgeText: { color: '#7D4B12', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    marginBottom: 10,
  },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 22 },
  codeCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    backgroundColor: colors.paper,
    marginBottom: 16,
  },
  code: {
    color: colors.blueDark,
    fontFamily: 'monospace',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginVertical: 12,
  },
  copyButton: {
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },
  copyText: { color: colors.blueDark, fontSize: 13, fontWeight: '900' },
  tipCard: {
    borderRadius: 19,
    padding: 16,
    backgroundColor: '#FFF3E4',
    marginBottom: 22,
  },
  tipTitle: { color: '#7D4B12', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  tipText: { color: '#805F38', fontSize: 12, lineHeight: 18 },
  doneButton: {
    minHeight: 55,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  doneText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
