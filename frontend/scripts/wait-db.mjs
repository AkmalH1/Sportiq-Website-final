// Waits until the MySQL database from DATABASE_URL (frontend/.env.local) accepts connections.
// Exit 0 = ready, exit 1 = still unreachable after the timeout (a plain-English explanation is printed).
import net from "node:net";
import fs from "node:fs";

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const m = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (m) url = m[1].trim();
  } catch {}
}
if (!url) { console.log(" DATABASE_URL is not set (frontend/.env.local)."); process.exit(1); }
const u = new URL(url);
const host = u.hostname, port = Number(u.port || 3306);
const limit = Number(process.argv[2] || 90) * 1000;
const start = Date.now();

const tryOnce = () => new Promise((res) => {
  const s = net.connect({ host, port, timeout: 2000 });
  s.on("connect", () => { s.destroy(); res(true); });
  s.on("error", () => res(false));
  s.on("timeout", () => { s.destroy(); res(false); });
});

process.stdout.write(` Waiting for the database at ${host}:${port} `);
while (Date.now() - start < limit) {
  if (await tryOnce()) { console.log("\n Database is ready."); process.exit(0); }
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 2000));
}
console.log(`

 ERROR: cannot reach MySQL at ${host}:${port}. The store cannot work without it.
 Fix ONE of these, then run this file again:
   1. Docker Desktop: install it, OPEN it (wait until it says "running"), then run this file again.
   2. No Docker: install MySQL 8 (or XAMPP/MariaDB), start it, and create:
        database  sportiq    user  sportiq    password  sportiq
      (MySQL commands:  CREATE DATABASE sportiq CHARACTER SET utf8mb4;
                        CREATE USER 'sportiq'@'%' IDENTIFIED BY 'sportiq';
                        GRANT ALL ON sportiq.* TO 'sportiq'@'%';)
   3. Using another MySQL? Edit DATABASE_URL in frontend/.env.local.
`);
process.exit(1);
