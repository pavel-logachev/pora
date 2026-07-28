import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PoraIcon } from '../../ui/PoraIcon';

const colors = {
  blue: '#4658D9',
  blueSoft: '#E9EDFF',
  mist: '#F3F5FB',
  paper: '#FFFFFF',
  ink: '#17203B',
  muted: '#717A94',
  line: '#DFE3ED',
  success: '#25866C',
  warning: '#A96320',
  danger: '#A53F37',
};

export type NotificationStatus = 'granted' | 'denied' | 'not-determined';

export interface SettingsScreenProps {
  accountEmail: string | null;
  notificationStatus: NotificationStatus;
  onBack: () => void;
  onOpenAccount: () => void;
  onConfigureNotifications: () => void;
  onExport: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

function notificationCopy(status: NotificationStatus) {
  switch (status) {
    case 'granted':
      return { label: 'Разрешены', tone: 'success' as const };
    case 'denied':
      return { label: 'Отключены в системе', tone: 'danger' as const };
    case 'not-determined':
      return { label: 'Нужно разрешение', tone: 'warning' as const };
  }
}

export function SettingsScreen({
  accountEmail,
  notificationStatus,
  onBack,
  onOpenAccount,
  onConfigureNotifications,
  onExport,
  onOpenPrivacy,
  onOpenTerms,
}: SettingsScreenProps) {
  const notification = notificationCopy(notificationStatus);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад из настроек"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <PoraIcon color={colors.paper} name="arrow-left" size={23} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>ПОРА</Text>
          <Text style={styles.title}>Настройки</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <PoraIcon color={colors.blue} name="account-outline" size={23} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Аккаунт и резервная копия</Text>
              <Text style={styles.statusText}>{accountEmail ?? 'Без аккаунта'}</Text>
            </View>
          </View>
          <Text style={styles.description}>
            Аккаунт синхронизирует личные курсы и историю между устройствами. Напоминания работают локально и без входа.
          </Text>
          <Pressable
            accessibilityLabel="Настроить аккаунт и синхронизацию"
            accessibilityRole="button"
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {accountEmail ? 'Управление аккаунтом' : 'Войти или зарегистрироваться'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <PoraIcon color={colors.blue} name="alarm" size={23} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Напоминания</Text>
              <Text style={[styles.statusText, styles[`status_${notification.tone}`]]}>
                {notification.label}
              </Text>
            </View>
          </View>
          <Text style={styles.description}>
            Android может потребовать отдельное разрешение на точные будильники. «Пора» покажет только необходимые системные шаги.
          </Text>
          <Pressable
            accessibilityLabel="Настроить уведомления"
            accessibilityRole="button"
            onPress={onConfigureNotifications}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Проверить и настроить</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <PoraIcon color={colors.blue} name="file-export-outline" size={23} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Экспорт</Text>
              <Text style={styles.statusText}>CSV с фактической историей</Text>
            </View>
          </View>
          <Text style={styles.description}>
            Файл можно сохранить на устройство или отправить врачу. В экспорт попадают пользовательские отметки, а не медицинские рекомендации.
          </Text>
          <Pressable
            accessibilityLabel="Экспортировать данные из настроек"
            accessibilityRole="button"
            onPress={onExport}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Экспортировать историю</Text>
          </Pressable>
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Данные и безопасность</Text>
          <Text style={styles.privacyText}>
            Курсы и напоминания сначала сохраняются только на телефоне. Каталожные данные и пользовательские назначения — разные сущности. «Пора» не ставит диагноз и не меняет назначение врача.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Политика конфиденциальности"
              onPress={onOpenPrivacy}
              style={({ pressed }) => [styles.legalButton, pressed && styles.pressed]}
            >
              <Text style={styles.legalText}>Конфиденциальность</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Условия использования"
              onPress={onOpenTerms}
              style={({ pressed }) => [styles.legalButton, pressed && styles.pressed]}
            >
              <Text style={styles.legalText}>Условия</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.version}>Пора · версия 1.0.2</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  header: {
    minHeight: 116,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.blue,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  eyebrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    color: colors.paper,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  content: { padding: 18, paddingBottom: 38, gap: 13 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },

  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  statusText: { color: colors.muted, fontSize: 10, marginTop: 3 },
  status_success: { color: colors.success, fontWeight: '800' },
  status_warning: { color: colors.warning, fontWeight: '800' },
  status_danger: { color: colors.danger, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  primaryButton: {
    minHeight: 43,
    marginTop: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
  },
  primaryButtonText: { color: colors.paper, fontSize: 11, fontWeight: '900' },
  secondaryButton: {
    minHeight: 43,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.blue, fontSize: 11, fontWeight: '900' },
  privacyCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.blueSoft,
  },
  privacyTitle: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  privacyText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  legalLinks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  legalButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  legalText: { color: colors.blue, fontSize: 10, fontWeight: '900' },
  version: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
