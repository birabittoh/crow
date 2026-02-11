import knex, { Knex } from 'knex';
import fs from 'fs';
import path from 'path';
import { config } from './config';

function ensureDataDir(): void {
  const dataDir = path.resolve('./data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const migrationsDir = path.resolve(__dirname, '..', 'migrations');

function createKnexConfig(): Knex.Config {
  if (config.usePostgres && config.postgres) {
    return {
      client: 'pg',
      connection: {
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
      },
      migrations: {
        directory: migrationsDir,
        extension: 'ts',
      },
    };
  }

  ensureDataDir();

  return {
    client: 'better-sqlite3',
    connection: {
      filename: './data/crow.db',
    },
    useNullAsDefault: true,
    migrations: {
      directory: migrationsDir,
      extension: 'ts',
    },
  };
}

export const db: Knex = knex(createKnexConfig());
