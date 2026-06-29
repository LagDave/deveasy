import type { Knex } from "knex";
import { loadConfig } from "./src/config";

const appConfig = loadConfig();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: appConfig.databaseUrl,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: "./src/database/migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./src/database/seeds",
      extension: "ts",
    },
  },
};

config.production = config.development;

export default config;
