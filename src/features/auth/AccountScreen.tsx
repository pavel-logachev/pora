import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AuthUser } from '../../sync/apiClient';
import { PoraIcon } from '../../ui/PoraIcon';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface AccountScreenProps {
  user: AuthUser;
  syncStatus: SyncStatus;
  onBack: () => void;
  onSync: () => Promise<void>;
  onLogout: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const colors = {
  blue: '#4658D9',
  blueSoft: '#E9EDFF',
  paper: '#FFFFFF',
  mist: '#F3F5FB',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  success: '#176B55',
  danger: '#9E4038',
};

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
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад к настройкам"
          onPress={onBack}
          style={styles.backButton}
        >
          <PoraIcon color={colors.paper} name="arrow-left" size={24} />
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
            <PoraIcon color={colors.blue} name="chevron-right" size={24} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  header: {
    minHeight: 102,
    paddingTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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

  eyebrow: { color: '#C7CEFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.paper, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
  content: { padding: 20, paddingBottom: 38 },
  profileCard: {
    borderRadius: 22,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },
  avatarText: { color: colors.blue, fontSize: 19, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 3 },
  email: { color: colors.muted, fontSize: 12 },
  syncCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusDotReady: { backgroundColor: colors.success },
  statusDotWarning: { backgroundColor: '#D08031' },
  syncCopy: { flex: 1 },
  syncTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 5 },
  syncDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  primaryButton: {
    minHeight: 52,
    marginTop: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  primaryText: { color: colors.paper, fontSize: 13, fontWeight: '900' },
  section: { marginTop: 25 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 3,
  },
  row: {
    minHeight: 69,
    borderRadius: 18,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  rowDescription: { color: colors.muted, fontSize: 10 },

  dangerCard: {
    marginTop: 22,
    borderRadius: 19,
    padding: 15,
    backgroundColor: '#FDECE9',
  },
  dangerTitle: { color: colors.danger, fontSize: 13, fontWeight: '900', marginBottom: 6 },
  dangerDescription: { color: '#7E514B', fontSize: 11, lineHeight: 16 },
  deleteButton: { minHeight: 42, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
