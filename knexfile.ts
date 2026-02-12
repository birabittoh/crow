import type { Knex } from 'knex';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const usePostgres = !!process.env.POSTGRES_HOST;

// Ensure data directory exists for SQLite
if (!usePostgres) {
  const dataDir = path.resolve('./data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const config: { [key: string]: Knex.Config } = {
  development: usePostgres
    ? {
        client: 'pg',
        connection: {
          host: process.env.POSTGRES_HOST,
          port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: process.env.POSTGRES_DB || 'crow',
          user: process.env.POSTGRES_USER || 'crow',
          password: process.env.POSTGRES_PASSWORD || '',
        },
        migrations: {
          directory: './migrations',
          extension: __filename.endsWith('.js') ? 'js' : 'ts',
        },
      }
    : {
        client: 'better-sqlite3',
        connection: {
          filename: './data/crow.db',
        },
        useNullAsDefault: true,
        migrations: {
          directory: './migrations',
          extension: __filename.endsWith('.js') ? 'js' : 'ts',
        },
      },
};

config.production = config.development;

export default config;
