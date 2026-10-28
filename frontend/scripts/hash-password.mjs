// Usage: node scripts/hash-password.mjs "your long password"
// Put the printed value in .env as ADMIN_PASSWORD_HASH and delete ADMIN_PASSWORD, so no plaintext password is stored on the server.
import { randomBytes, scryptSync } from "node:crypto";
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error("Give a password of at least 12 characters."); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log(`scrypt:${salt}:${scryptSync(pw, salt, 64).toString("hex")}`);
