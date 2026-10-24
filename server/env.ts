import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Load `.env` into `process.env` when the file exists. Values stay in this process:
 * they are never logged, returned by the API or written to an exam directory.
 */
export function loadEnvironment(file = path.join(process.cwd(), '.env')) {
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}
