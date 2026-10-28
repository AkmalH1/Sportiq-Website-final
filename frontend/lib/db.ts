import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";
import { runMigrations } from "./migrations";
import { alertOnce } from "./alert";

/**
 * MySQL / MariaDB access. Everything is async.
 *
 *   await db().prepare("SELECT * FROM orders WHERE id = ?").get(id)
 *   await tx(async (d) => { await d.prepare("UPDATE ...").run(a, b); })
 *
 * Inside tx() ALWAYS use the `d` you are given (never db()) so every statement belongs to the same transaction.
 */

export type RunResult = { lastInsertRowid: number; changes: number };

export interface Handle {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
}

export interface Statement {
  get(...args: unknown[]): Promise<unknown>;
  all(...args: unknown[]): Promise<unknown[]>;
  run(...args: unknown[]): Promise<RunResult>;
}

type Runner = Pool | PoolConnection;

const clean = (args: unknown[]) => args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a));

function handle(run: () => Promise<Runner>): Handle {
  const stmt = (sql: string): Statement => ({
    async get(...args) {
      const [rows] = await (await run()).query(sql, clean(args));
      return (rows as unknown[])[0];
    },
    async all(...args) {
      const [rows] = await (await run()).query(sql, clean(args));
      return rows as unknown[];
    },
    async run(...args) {
      const [res] = await (await run()).query(sql, clean(args));
      const r = res as ResultSetHeader;
      return { lastInsertRowid: Number(r.insertId ?? 0), changes: Number(r.affectedRows ?? 0) };
    },
  });
  return {
    prepare: stmt,
    async exec(sql) {
      await (await run()).query(sql);
    },
  };
}

/** DB_POOL_SIZE: whole number 1..100. A typo (for example "ten") stops startup with a clear message instead of becoming NaN. */
function poolSize(): number {
  const raw = (process.env.DB_POOL_SIZE ?? "").trim();
  if (!raw) return 10;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < 1 || n > 100) throw new Error("DB_POOL_SIZE must be a whole number between 1 and 100.");
  return n;
}

function config(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Example: mysql://user:password@127.0.0.1:3306/sportiq");
  const u = new URL(url);
  // A database on another machine must be reached over TLS. Only the bundled Docker database ("db") or this machine may use plain TCP.
  const privateHosts = ["db", "localhost", "127.0.0.1", "::1", "[::1]"];
  if (process.env.NODE_ENV === "production" && !privateHosts.includes(u.hostname) && process.env.DATABASE_SSL !== "true") {
    throw new Error(`DATABASE_URL points to ${u.hostname}, which is not the private Docker database. Set DATABASE_SSL=true (TLS is required for remote databases).`);
  }
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true, // DATETIME comes back as "YYYY-MM-DD HH:MM:SS" (UTC)
    decimalNumbers: true, // SUM() etc. come back as numbers
    connectionLimit: poolSize(),
    waitForConnections: true,
    // Fail fast instead of piling up forever when the database is slow or down: a bounded wait queue, a connect timeout, and
    // keep-alive so a firewall or a restarted database does not leave dead connections in the pool.
    queueLimit: 200,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    maxIdle: 5,
    idleTimeout: 60_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, "\n") } : {}) } : undefined,
  };
}

const g = globalThis as unknown as { __siqPool?: Pool; __siqReady?: Promise<void> };

function pool(): Pool {
  if (!g.__siqPool) {
    const p = mysql.createPool(config());
    // Every connection works in UTC with strict SQL so bad data is rejected, not silently trimmed.
    p.pool.on("connection", (c) => {
      c.query("SET time_zone = '+00:00'");
    });
    g.__siqPool = p;
  }
  return g.__siqPool;
}

/** Applies pending migrations once per process (guarded by a database lock so several instances can start together). */
function ready(): Promise<void> {
  if (!g.__siqReady) {
    g.__siqReady = (async () => {
      const conn = await pool().getConnection();
      try {
        await conn.query("SELECT GET_LOCK('sportiq_migrate', 120)");
        await runMigrations(handle(async () => conn));
      } finally {
        await conn.query("SELECT RELEASE_LOCK('sportiq_migrate')").catch(() => {});
        conn.release();
      }
    })();
    g.__siqReady.catch((e) => {
      g.__siqReady = undefined; // allow a retry on the next request, e.g. if MySQL was still starting
      console.error("[db] start-up (connect / migrations) failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown error");
      void alertOnce("db-start", "The database could not be reached or migrations failed at start-up. The site retries on every request; check the db container and the server log.", 10 * 60 * 1000);
    });
  }
  return g.__siqReady;
}

const waiting = handle(async () => {
  await ready();
  return pool();
});

/** The shared connection pool. Waits for migrations on first use. */
export function db(): Handle {
  return waiting;
}

const isRetryable = (e: unknown) => {
  const code = (e as { errno?: number })?.errno;
  return code === 1213 || code === 1205; // deadlock, lock wait timeout
};

/** Runs fn in a transaction (READ COMMITTED). Rolls back on error and retries deadlocks up to 3 times. */
export async function tx<T>(fn: (d: Handle) => Promise<T>): Promise<T> {
  await ready();
  for (let attempt = 1; ; attempt++) {
    const conn = await pool().getConnection();
    try {
      await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await conn.beginTransaction();
      const out = await fn(handle(async () => conn));
      await conn.commit();
      return out;
    } catch (e) {
      await conn.rollback().catch(() => {});
      if (isRetryable(e) && attempt < 3) continue;
      throw e;
    } finally {
      conn.release();
    }
  }
}

export async function audit(actor: string, action: string, detail = "", d: Handle = db()) {
  await d.prepare("INSERT INTO audit_logs (actor, action, detail) VALUES (?,?,?)").run(actor, action, detail.slice(0, 500));
}

/** Escapes % and _ so user text is matched literally inside LIKE. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
