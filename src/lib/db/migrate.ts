import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Lokal steht die Verbindung in .env.local, auf Vercel kommt sie aus der
// Umgebung — beides muss gehen, weil der Build die Migration mitzieht.
config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt.");
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("[migrate] fertig");
}

main().catch((err) => {
  console.error("[migrate] fehlgeschlagen:", err);
  process.exit(1);
});
