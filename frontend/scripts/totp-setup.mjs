// Usage: node scripts/totp-setup.mjs
// Prints a new two-factor secret. Put it in .env as ADMIN_TOTP_SECRET, then add it to an authenticator app
// (Google Authenticator, Authy, 1Password, Microsoft Authenticator) by typing the secret or opening the otpauth link as a QR code.
import { randomBytes } from "node:crypto";
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0, value = 0, secret = "";
for (const b of randomBytes(20)) {
  value = (value << 8) | b; bits += 8;
  while (bits >= 5) { secret += A[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log(`otpauth://totp/SPORTIQ%20Admin?secret=${secret}&issuer=SPORTIQ&algorithm=SHA1&digits=6&period=30`);
