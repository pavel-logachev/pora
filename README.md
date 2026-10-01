<p align="center">
  <img src="docs/assets/pora-showcase.png" alt="Пора — напоминания о лекарствах для Android: экран «Сегодня», подсказки справочника ЕСКЛП, аптечка и тёмная тема" width="100%">
</p>

# Пора

**Local-first Android-приложение для расписания лекарств, точных напоминаний и истории приёмов.** Основной сценарий работает без аккаунта и без сервера; аккаунт нужен только для резервной копии и синхронизации.

<p align="center"><a href="https://github.com/pavel-logachev/pora/releases/tag/v1.1.0"><strong>Android 1.1.0</strong></a> &nbsp;·&nbsp; <a href="https://github.com/pavel-logachev/pora/actions">CI</a> &nbsp;·&nbsp; Android 7+ &nbsp;·&nbsp; <a href="LICENSE">MIT</a></p>

<p align="center">
  <img src="docs/assets/pora-features.png" alt="Реальные экраны Поры: история приёмов, выбор препарата из справочника ЕСКЛП и аптечка в тёмной теме" width="100%">
</p>

> **Статус:** Android-релиз 1.1.0 — справочник лекарств ЕСКЛП и новый дизайн. APK подписан **новым** ключом (ключ 1.0.x утрачен), поэтому поверх 1.0.x он не ставится: см. «Установка». В Google Play приложение не опубликовано.

## Что решает продукт

«Пора» хранит назначения локально и помогает пройти короткий ежедневный цикл без лишних экранов:

1. Создать курс.
2. Получить точное уведомление.
3. Отметить приём или пропуск.
4. Увидеть результат в истории.

Приложение не назначает лечение, не проверяет совместимость препаратов и не заменяет врача или инструкцию.

## Реализовано

- локальная SQLite-база и полноценная работа без аккаунта;
- несколько приёмов в сутки и необязательная дата окончания курса;
- нативные Android spinner-пикеры времени и даты;
- точные Android alarms, восстановление расписания после reboot и пересчёт при смене timezone;
- действия из уведомления: принять или пропустить;
- история событий и экспорт;
- контроль остатка лекарства;
- офлайн-справочник лекарств ЕСКЛП Минздрава России (23 001 препарат): подсказки по названию и действующему веществу, дозировка, форма, ЖНВЛП;
- светлая и тёмная тема по настройке системы;
- optional account sync с token rotation, recovery code и удалением аккаунта;
- Argon2id для паролей, hashed recovery/refresh tokens и HTTPS;
- accessibility labels и увеличенные touch targets.

## Установка

1. Откройте [GitHub Release 1.1.0](https://github.com/pavel-logachev/pora/releases/tag/v1.1.0).
2. Скачайте `Pora-1.1.0-android.apk` и файл `.sha256` рядом с ним.
3. Разрешите установку приложений из выбранного источника, если Android запросит это.
4. В настройках «Поры» разрешите уведомления и точные будильники.
5. На Xiaomi, Samsung и Huawei дополнительно проверьте ограничения батареи.

> **Обновление с 1.0.x.** Ключ подписи 1.0.x утрачен, поэтому 1.1.0 нужно ставить заново, а не поверх. Перед удалением старой версии войдите в аккаунт «Пора» и дождитесь синхронизации (или выгрузите историю в CSV): после установки курсы вернутся из аккаунта. Данные без аккаунта хранятся только на телефоне. Подробности — в [release notes](docs/release/RELEASE_NOTES_1.1.0.md).

- Package ID: `net.logachev.pora`
- Version: `1.1.0 (6)`
- Minimum: Android 7.0 / API 24
- Target: Android 16 / API 36
- Signing certificate SHA-256: `b614b5a5af9fde7264c5f42788e51648b6f66ff2473289333d2258d5fb9d510f`
- APK SHA-256: `e54800ad15c2d258892f6c61d2813ce434aaeea7f569cea2315481192398ea60`

Полные release notes: [docs/release/RELEASE_NOTES_1.1.0.md](docs/release/RELEASE_NOTES_1.1.0.md). Предыдущий релиз: [1.0.2](docs/release/RELEASE_NOTES_1.0.2.md). Как была восстановлена версия 1.0.4 со справочником: [docs/RECOVERY_1_0_4.md](docs/RECOVERY_1_0_4.md).

## Архитектура

**React Native / Expo app**

- domain model и SQLite repository;
- справочник ЕСКЛП: встроенная SQLite-база с полнотекстовым поиском (FTS5), проверка версии и размера при открытии;
- единая тема (светлая и тёмная) в `src/ui/theme.ts`;
- notification planner и reconciler;
- нативный Android exact-alarm module;
- secure session store;
- optional sync client через HTTPS.

**Fastify API**

- Argon2id auth и JWT rotation;
- idempotent event stream;
- PostgreSQL.

Подробности: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Запуск приложения из исходников

Требования: Node.js 24, npm, Android SDK и JDK 21.

```bash
npm ci
npm run typecheck
npm test -- --runInBand
npx expo-doctor
npm run android
```

Подписанная release-сборка (ключ и пароль берутся из каталога вне репозитория, см. заголовок скрипта):

```bash
python scripts/build-android-release.py
```

Для web preview:

```bash
npm run web
```

## Запуск API

```bash
cd backend
cp .env.example .env
npm ci
npm run migrate
npm run dev
```

Нужны PostgreSQL и собственный `JWT_SECRET` длиной не менее 32 символов. Production secrets в репозитории отсутствуют.

## Проверка

Для 1.1.0 подтверждены:

- mobile: 21 Jest suites / 78 tests (включая поиск по реальному файлу справочника и миграции), TypeScript;
- подписанный APK 1.1.0 (6): `apksigner verify`, APK Signature Scheme v2, RSA 3072, установка и запуск на Android 16 emulator, светлая и тёмная тема;

Для release-линии 1.0.2 (код уведомлений с тех пор не менялся) ранее подтверждены:

- mobile: 18 Jest suites / 37 tests, TypeScript и Expo Doctor 20/20;
- backend: 2 Vitest suites / 8 tests, TypeScript и production build;
- signed APK 1.0.2 (3): APK Signature Scheme v2 и сертификат RSA 3072;
- clean install и update install на Android 16 emulator;
- Exact Alarm в forced deep Doze, действия уведомлений и восстановление после reboot;
- нативные time/date pickers, несколько приёмов в сутки и отмена незавершённого выбора;
- production `/health`, privacy и terms endpoints.

## Структура

- `src/` — mobile domain, data, catalog, UI, notifications и sync;
- `modules/pora-device-settings/` — нативная Android exact-alarm integration;
- `backend/` — Fastify/PostgreSQL sync service;
- `scripts/` — production smoke test и `build-android-release.py` (подписанная сборка; ключ лежит вне репозитория);
- `docs/` — architecture, screenshots и release evidence.

## Приватность и безопасность

- локальные функции не требуют аккаунта;
- аудио, реклама и рекламное профилирование отсутствуют;
- серверная синхронизация включается только после создания аккаунта;
- аккаунт и серверную копию можно удалить из приложения;
- секреты подписи APK и production credentials не входят в репозиторий; справочник ЕСКЛП только подсказывает названия и не отправляется на сервер.

- Политика: https://pora.194-87-101-107.sslip.io/legal/privacy
- Условия: https://pora.194-87-101-107.sslip.io/legal/terms
- Security policy: [SECURITY.md](SECURITY.md)

## Ограничения

- release не опубликован в Google Play;
- iOS target описан в Expo config, но iOS build и acceptance не подтверждены;
- доставка уведомлений зависит от OEM-настроек батареи;
- приложение не является медицинским изделием.

## Лицензия

Код проекта — [MIT](LICENSE). Сторонние компоненты сохраняют собственные лицензии; см. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
