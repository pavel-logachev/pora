import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { AuthUser } from '../../sync/apiClient';
import { PoraIcon } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface AccountScreenProps {
  user: AuthUser;
  syncStatus: SyncStatus;
  onBack: () => void;
  onSync: () => Promise<void>;
  onLogout: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const statusText: Record<SyncStatus, string> = {
  idle: 'Готово к синхронизации',
  syncing: 'Синхронизируем…',
  synced: 'Данные синхронизированы',
  offline: 'Нет сети — данные сохранены на телефоне',
  error: 'Не удалось синхронизировать',
};

export function AccountScreen({
  user,
  syncStatus,
  onBack,
  onSync,
  onLogout,
  onDelete,
}: AccountScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад к настройкам"
          onPress={onBack}
          style={styles.backButton}
        >
          <PoraIcon color={theme.ink} name="arrow-left" size={24} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>АККАУНТ</Text>
          <Text style={styles.title}>Синхронизация</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user.displayName || user.email).slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileCopy}>
            {user.displayName ? <Text style={styles.name}>{user.displayName}</Text> : null}
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.syncCard}>
          <View
            style={[
              styles.statusDot,
              syncStatus === 'error' || syncStatus === 'offline'
                ? styles.statusDotWarning
                : styles.statusDotReady,
            ]}
          />
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{statusText[syncStatus]}</Text>
            <Text style={styles.syncDescription}>
              Лекарства, курсы и история передаются по HTTPS. Напоминания продолжают
              работать локально.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Синхронизировать сейчас"
          disabled={syncStatus === 'syncing'}
          onPress={() => void onSync()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Синхронизировать сейчас</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>СЕССИЯ</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Выйти из аккаунта"
            onPress={() => void onLogout()}
            style={styles.row}
          >
            <View>
              <Text style={styles.rowTitle}>Выйти из аккаунта</Text>
              <Text style={styles.rowDescription}>Локальные данные останутся на телефоне</Text>
            </View>
            <PoraIcon color={theme.primaryInk} name="chevron-right" size={24} />
          </Pressable>
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Удаление аккаунта</Text>
          <Text style={styles.dangerDescription}>
            Серверная копия и учетная запись будут удалены без возможности восстановления.
            Локальные курсы останутся на этом телефоне.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Удалить аккаунт"
            onPress={() => void onDelete()}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteText}>Удалить аккаунт</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: {
    minHeight: 76,
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
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
  eyebrow: { color: theme.primaryInk, fontSize: 12, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 1 },
  title: { color: theme.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  content: { padding: 16, paddingBottom: 38 },
  profileCard: {
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  avatarText: { color: theme.onPrimary, fontSize: 22, fontWeight: '800' as const },
  profileCopy: { flex: 1 },
  name: { color: theme.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' as const },
  email: { color: theme.muted, fontSize: 14, lineHeight: 19 },
  syncCard: {
    marginTop: 14,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row' as const,
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  statusDotReady: { backgroundColor: theme.success },
  statusDotWarning: { backgroundColor: theme.warning },
  syncCopy: { flex: 1 },
  syncTitle: { color: theme.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' as const, marginBottom: 4 },
  syncDescription: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    minHeight: 54,
    marginTop: 14,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  primaryText: { color: theme.onPrimary, fontSize: 16, fontWeight: '800' as const },
  section: { marginTop: 26 },
  sectionTitle: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    minHeight: 72,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  rowTitle: { color: theme.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' as const },
  rowDescription: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  dangerCard: {
    marginTop: 22,
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: theme.dangerSoft,
  },
  dangerTitle: { color: theme.danger, fontSize: 15, lineHeight: 20, fontWeight: '800' as const, marginBottom: 6 },
  dangerDescription: { color: theme.ink, fontSize: 13, lineHeight: 19 },
  deleteButton: { minHeight: 48, marginTop: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  deleteText: { color: theme.danger, fontSize: 15, fontWeight: '800' as const },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
