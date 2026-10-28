// Checks that the app's database login works; if not, tries to create the database and user using the
// default local admin login (root, no password: the XAMPP default). Runs after wait-db.mjs. Exit 0 = ok.
import fs from "node:fs";
import mysql from "mysql2/promise";

let url = process.env.DATABASE_URL;
if (!url) {
  try { const m = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^DATABASE_URL=(.+)$/m); if (m) url = m[1].trim(); } catch {}
}
const u = new URL(url);
const user = decodeURIComponent(u.username), password = decodeURIComponent(u.password), database = u.pathname.slice(1);
const host = u.hostname, port = Number(u.port || 3306);

const test = async () => {
  try { const c = await mysql.createConnection({ host, port, user, password, database }); await c.end(); return null; }
  catch (e) { return e; }
};

let err = await test();
if (!err) { console.log(" Database login works."); process.exit(0); }
console.log(` Database login failed (${err.code}). Trying to set it up automatically...`);

const q = (s) => "`" + s.replace(/`/g, "``") + "`";
for (const rootPw of ["", "root"]) {
  try {
    const c = await mysql.createConnection({ host, port, user: "root", password: rootPw, multipleStatements: true });
    await c.query(`CREATE DATABASE IF NOT EXISTS ${q(database)} CHARACTER SET utf8mb4`);
    for (const h of ["localhost", "127.0.0.1", "%"]) {
      await c.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [user, h, password]);
      await c.query("ALTER USER ?@? IDENTIFIED BY ?", [user, h, password]);
      await c.query(`GRANT ALL ON ${q(database)}.* TO ?@?`, [user, h]);
    }
    await c.query("FLUSH PRIVILEGES");
    await c.end();
    err = await test();
    if (!err) { console.log(` Created database "${database}" and user "${user}". Ready.`); process.exit(0); }
  } catch (e) { /* try next password */ }
}
console.log(`
 ERROR: MySQL is running, but the SPORTIQ login does not work (${err.code}: ${err.message}).
 I also could not log in as the MySQL admin (root) without a password to fix it.
 Open phpMyAdmin (XAMPP Control Panel > MySQL > Admin) > SQL tab, paste this, click Go, then run this file again:

   CREATE DATABASE IF NOT EXISTS sportiq CHARACTER SET utf8mb4;
   CREATE USER IF NOT EXISTS 'sportiq'@'localhost' IDENTIFIED BY 'sportiq';
   CREATE USER IF NOT EXISTS 'sportiq'@'127.0.0.1' IDENTIFIED BY 'sportiq';
   GRANT ALL ON sportiq.* TO 'sportiq'@'localhost';
   GRANT ALL ON sportiq.* TO 'sportiq'@'127.0.0.1';
   FLUSH PRIVILEGES;
`);
process.exit(1);
