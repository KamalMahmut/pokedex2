const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pokedex",
    port: Number(process.env.DB_PORT || 3306)
  });

  const email = (process.env.ADMIN_EMAIL || "admin@pokedex.com").trim().toLowerCase();
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await db.execute(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       password_hash = VALUES(password_hash),
       role = 'admin'`,
    [username, email, passwordHash]
  );

  await db.end();

  console.log("Admin account is ready.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch((error) => {
  console.error("Failed to seed admin account:", error);
  process.exit(1);
});
