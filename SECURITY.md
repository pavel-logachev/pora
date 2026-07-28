# Security policy

## Supported release

Security fixes are applied to the current `1.0.x` release line and to `main`.

## Reporting

Please use GitHub's **Private vulnerability reporting** for repository-level issues. If that channel is unavailable, write to `pora@logachev.net` without including real medication data, passwords, recovery codes, access tokens or APK signing material.

Do not open public issues with credentials, personal health information or production exploit details.

## Security boundaries

- Medication schedules and notification state are local by default.
- Account sync is optional and uses HTTPS.
- Android session tokens are stored in the platform secure store.
- Passwords use Argon2id; recovery codes and refresh tokens are stored server-side only as hashes.
- APK signing material and production environment files are not part of this repository.
- «Пора» is not a medical device and does not validate prescriptions or drug interactions.
