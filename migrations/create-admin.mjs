import { createInterface } from "readline";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL non impostata");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const email = await ask("Email admin: ");
const password = await ask("Password: ");
rl.close();

if (!email || !password) {
  console.error("Email e password sono obbligatorie.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')",
    [email, hash]
  );
  console.log(`✓ Admin "${email}" creato.`);
} catch (err) {
  if (err.code === "23505") {
    console.error(`Utente "${email}" già esistente.`);
  } else {
    console.error("Errore:", err.message);
  }
  process.exit(1);
} finally {
  await pool.end();
}
