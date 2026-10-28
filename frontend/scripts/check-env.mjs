// Deployment check. Usage (from frontend/):
//   node --experimental-strip-types scripts/check-env.mjs [--env-file ../.env] [--production]
// Reads the variables from the environment (and optionally a .env file), prints PASS/FAIL per problem, exits 1 on any error.
// It names the variable that is wrong; it never prints a secret value.
import { readFileSync } from "node:fs";
import { checkEnv } from "../lib/env-check.ts";

const args = process.argv.slice(2);
const env = { ...process.env };
const f = args.indexOf("--env-file");
if (f >= 0) {
  try {
    for (const line of readFileSync(args[f + 1], "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch { console.error("Could not read the env file."); process.exit(2); }
}
if (args.includes("--production")) env.NODE_ENV = "production";
const { errors, warnings } = checkEnv(env);
for (const m of errors) console.log("FAIL  " + m);
for (const m of warnings) console.log("WARN  " + m);
if (!errors.length) console.log("PASS  configuration accepted" + (env.NODE_ENV === "production" ? " for production" : " (NODE_ENV is not production: production-only rules were not applied; add --production)"));
process.exit(errors.length ? 1 : 0);
