// The directory is a binary asset bundled by Metro (`db` is listed in metro.config.js). It lives in its own
// module so tests can replace it with jest.mock() instead of teaching Jest to load SQLite files.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const medicationCatalogAsset: number = require('../../assets/catalog/pora-catalog.db');
