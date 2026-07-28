# Contributing

This repository documents an independent product and accepts focused bug reports and reproducible fixes.

## Before opening an issue

- Remove medication names, email addresses, recovery codes and tokens from screenshots or logs.
- Include Android version, device/OEM, app version and the exact steps to reproduce.
- For missed notifications, include whether exact alarms and battery exemptions were enabled.

## Local verification

```bash
npm ci
npm run typecheck
npm test -- --runInBand
npx expo-doctor

cd backend
npm ci
npm run typecheck
npm test
npm run build
```

Keep changes narrow, preserve local-first behavior and add a regression test for behavior changes. Security reports belong in the private channel described in [SECURITY.md](SECURITY.md).
