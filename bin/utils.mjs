/**
 * Shared helpers for CLI bin scripts.
 */

import path from "node:path";
import fs from "node:fs";
import {pathToFileURL} from "node:url";

/**
 * Load an optional per-repo config file from cwd.
 *
 * Each CLI tool looks for `<tool>.config.mjs` (e.g.
 * `readability.config.mjs`) in the consumer's project root.
 */
export async function loadConfig(filename) {
  const cfgPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(cfgPath)) return {};
  return import(pathToFileURL(cfgPath).href);
}
