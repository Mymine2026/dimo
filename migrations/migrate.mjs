import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL non impostata");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const files = ["001_create_users.sql", "002_create_companies_and_vehicles.sql"];

for (const file of files) {
  const sql = readFileSync(join(__dirname, file), "utf8");
  console.log(`Applico ${file}…`);
  await pool.query(sql);
  console.log(`✓ ${file}`);
}

await pool.end();
console.log("Migrazione completata.");
