import type { Knex } from "knex";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../../");

const config: { [key: string]: Knex.Config } = {
  development: {
    client: process.env.POSTGRES_HOST ? "pg" : "sqlite3",
    connection: process.env.POSTGRES_HOST
      ? {
          host: process.env.POSTGRES_HOST,
          port: parseInt(process.env.POSTGRES_PORT || "5432"),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
        }
      : {
          filename: process.env.SQLITE_FILENAME || path.join(rootDir, "crow.sqlite"),
        },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      extension: "ts",
    },
  },
  production: {
    client: process.env.POSTGRES_HOST ? "pg" : "sqlite3",
    connection: process.env.POSTGRES_HOST
      ? {
          host: process.env.POSTGRES_HOST,
          port: parseInt(process.env.POSTGRES_PORT || "5432"),
          user: process.env.POSTGRES_USER,
          password: process.env.POSTGRES_PASSWORD,
          database: process.env.POSTGRES_DB,
          ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
        }
      : {
          filename: process.env.SQLITE_FILENAME || path.join(rootDir, "crow.sqlite"),
        },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      extension: "ts",
    },
  },
};

export default config;
