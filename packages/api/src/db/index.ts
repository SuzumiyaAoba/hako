import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databasePath = process.env["DATABASE_URL"] ?? "data/hako.db";

const sqlite = new Database(databasePath);
const db = drizzle(sqlite, { schema });

export { db, sqlite };
