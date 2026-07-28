import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresPoraStore } from './store/postgresStore.js';

const config = loadConfig();
const store = PostgresPoraStore.connect(config.databaseUrl);
const app = await buildApp({ config: config.app, store, logger: true });

async function shutdown(signal: string) {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.host, port: config.port });
