// Concurrency test of the atomic statement against the real database (same SQL as lib/ratelimit.ts)
import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "127.0.0.1", user: "sportiq", password: "sportiq", database: "sportiq", connectionLimit: 40 });
await pool.query("CREATE TABLE IF NOT EXISTS rate_limits (k VARCHAR(120) NOT NULL PRIMARY KEY, n INT NOT NULL, reset_at BIGINT NOT NULL, KEY rl_reset (reset_at))");
await pool.query("DELETE FROM rate_limits");
const SQL = `INSERT INTO rate_limits (k, n, reset_at) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE n = LAST_INSERT_ID(IF(reset_at <= ?, 1, n + 1)), reset_at = IF(reset_at <= ?, ?, reset_at)`;
const hit = async (k, w) => { const now = Date.now(); const [r] = await pool.query(SQL, [k, now + w, now, now, now + w]); return r.insertId || 1; };
const N = 200, MAX = 8;
const counts = await Promise.all(Array.from({ length: N }, () => hit("login:x", 60000)));
const allowed = counts.filter((c) => c <= MAX).length;
const distinct = new Set(counts).size;
console.log({ requests: N, max: MAX, allowed, distinctCounts: distinct, maxSeen: Math.max(...counts) });
if (allowed !== MAX || distinct !== N) { console.log("FAIL"); process.exit(1); }
// one-time-code replay: 50 concurrent uses of the same key, exactly 1 may win
const r = await Promise.all(Array.from({ length: 50 }, () => hit("totp-used:1", 120000)));
console.log({ replayWinners: r.filter((c) => c <= 1).length });
if (r.filter((c) => c <= 1).length !== 1) { console.log("FAIL"); process.exit(1); }
// window expiry resets
await pool.query("UPDATE rate_limits SET reset_at = ? WHERE k = 'login:x'", [Date.now() - 1]);
console.log({ afterExpiry: await hit("login:x", 60000) });
console.log("PASS"); process.exit(0);
