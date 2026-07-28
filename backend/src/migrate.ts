import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import postgres from 'postgres';

import { loadConfig } from './config.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

export async function runMigrations(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const applied = await sql<{ version: string }[]>`
        SELECT version FROM schema_migrations WHERE version = ${file}
      `;
      if (applied[0]) continue;
      const source = await readFile(`${migrationsDirectory}/${file}`, 'utf8');
      await sql.begin(async (transaction) => {
        await transaction.unsafe(source);
        await transaction`
          INSERT INTO schema_migrations (version) VALUES (${file})
        `;
      });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  await runMigrations(config.databaseUrl);
}
