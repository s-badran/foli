import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Load a dotenv file into `process.env` when it exists. Values stay in this process:
 * they are never logged, returned by the API or written to an exam directory.
 *
 * Set `FOLIO_ENV_FILE` to point at another file, or to empty to skip loading (used by
 * browser tests so a developer key never leaks into a test server).
 */
export function loadEnvironment(file = path.join(process.cwd(), '.env')) {
  if (process.env.FOLIO_ENV_FILE !== undefined) {
    if (!process.env.FOLIO_ENV_FILE) return false;
    file = process.env.FOLIO_ENV_FILE;
  }
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}
