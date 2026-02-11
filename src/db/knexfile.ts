import type { Knex } from "knex";
import path from "path";

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
          filename: process.env.SQLITE_FILENAME || path.join(process.cwd(), "crow.sqlite"),
        },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
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
          filename: process.env.SQLITE_FILENAME || path.join(process.cwd(), "crow.sqlite"),
        },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
      extension: "ts",
    },
  },
};

export default config;
