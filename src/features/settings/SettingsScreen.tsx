import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { appVersion as defaultAppVersion } from '../../appVersion';
import {
  MEDICATION_CATALOG_RECORD_COUNT,
  MEDICATION_CATALOG_VERSION,
  catalogSourceLabel,
} from '../../catalog/medicationCatalog';
import { PoraIcon, type PoraIconName } from '../../ui/PoraIcon';
import { radius, useStyles, useTheme, type Theme } from '../../ui/theme';

export type NotificationStatus = 'granted' | 'denied' | 'not-determined';

export interface SettingsScreenProps {
  accountEmail: string | null;
  notificationStatus: NotificationStatus;
  appVersion?: string;
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

function formatCount(value: number) {
  return value.toLocaleString('ru-RU').replace(/ /g, ' ');
}

export function SettingsScreen({
  accountEmail,
  notificationStatus,
  appVersion = defaultAppVersion,
  onBack,
  onOpenAccount,
  onConfigureNotifications,
  onExport,
  onOpenPrivacy,
  onOpenTerms,
}: SettingsScreenProps) {
  const theme = useTheme();
  const styles = useStyles(createStyles);
  const notification = notificationCopy(notificationStatus);

  function icon(name: PoraIconName) {
    return (
      <View style={styles.iconBox}>
        <PoraIcon color={theme.primaryInk} name={name} size={24} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад из настроек"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <PoraIcon color={theme.ink} name="arrow-left" size={24} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>ПОРА</Text>
          <Text style={styles.title}>Настройки</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            {icon('account-outline')}
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
            {icon('alarm')}
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
            {icon('file-export-outline')}
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

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            {icon('database-search-outline')}
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Справочник лекарств</Text>
              <Text style={styles.statusText}>
                {catalogSourceLabel(MEDICATION_CATALOG_VERSION)}
              </Text>
            </View>
          </View>
          <Text style={styles.description}>
            {formatCount(MEDICATION_CATALOG_RECORD_COUNT)} препаратов лежат на телефоне и работают без интернета. Справочник только подсказывает название, форму и действующее вещество — назначение остаётся вашим.
          </Text>
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

        <Text style={styles.version}>Пора · версия {appVersion}</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
  eyebrow: {
    color: theme.primaryInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  title: {
    color: theme.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primarySoft,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: theme.ink, fontSize: 16, lineHeight: 21, fontWeight: '800' as const },
  statusText: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  status_success: { color: theme.success, fontWeight: '800' as const },
  status_warning: { color: theme.warning, fontWeight: '800' as const },
  status_danger: { color: theme.danger, fontWeight: '800' as const },
  description: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  primaryButton: {
    minHeight: 50,
    marginTop: 14,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.primary,
  },
  primaryButtonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '800' as const },
  secondaryButton: {
    minHeight: 50,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryButtonText: { color: theme.primaryInk, fontSize: 15, fontWeight: '800' as const },
  privacyCard: {
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: theme.primarySoft,
  },
  privacyTitle: { color: theme.primaryInk, fontSize: 15, lineHeight: 20, fontWeight: '800' as const },
  privacyText: { color: theme.ink, fontSize: 13, lineHeight: 19, marginTop: 6 },
  legalLinks: { flexDirection: 'row' as const, gap: 8, marginTop: 12 },
  legalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
  },
  legalText: { color: theme.primaryInk, fontSize: 13, fontWeight: '800' as const },
  version: { color: theme.muted, fontSize: 12, textAlign: 'center' as const, marginTop: 4 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
