import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL fehlt — .env.local anlegen oder in Vercel setzen.");

// In der Entwicklung überlebt die Verbindung den Hot Reload, sonst sammeln
// sich mit jedem Speichern neue Pools an.
const globalForDb = globalThis as unknown as { arianeSql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.arianeSql ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.arianeSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
