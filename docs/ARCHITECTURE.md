# Architecture

## Product boundary

The mobile application owns the complete reminder workflow. Creating a course, planning exact alarms, recording an action and reading local history do not depend on the API. The backend is an optional synchronization boundary, not a prerequisite for the core product.

## Mobile layers

- `src/domain` contains immutable medication-course and local-day rules.
- `src/data` persists courses, events and projections in SQLite.
- `src/notifications` derives and reconciles Android notification plans.
- `modules/pora-device-settings` exposes exact-alarm and battery-optimization settings through a small Expo native module.
- `src/sync` converts local events into an idempotent remote stream and stores sessions in the platform secure store.
- `src/features` contains user-facing flows and keeps persistence behind repositories.

## Sync service

The Fastify API provides registration, login, one-time recovery-code rotation, refresh-token rotation, account deletion and an append-only event stream. PostgreSQL owns user-scoped sequence ordering and deduplication. Access is isolated by authenticated user at the HTTP and store boundaries.

## Delivery guarantees

Notification reconciliation runs from persisted local state, so API failure does not remove the current device schedule. Android exact alarms and boot recovery are handled by the native layer. OEM battery policies remain outside the application's control and require explicit user configuration on some devices.

## Trust model

- HTTPS protects data in transit.
- Passwords are hashed with Argon2id.
- Recovery codes and refresh tokens are stored only as hashes on the server.
- The sync service is not end-to-end encrypted and must not be described as such.
- The application records user-entered schedules but does not validate clinical correctness.
