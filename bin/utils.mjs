/**
 * Shared helpers for CLI bin scripts.
 */

import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {pathToFileURL} from "node:url";

/**
 * Open a file or URL with the platform opener, detached so the CLI can exit.
 *
 * text/html must be associated with a browser, not a mail client; if the
 * opener mis-routes on Linux, run e.g.
 *   xdg-mime default firefox_firefox.desktop text/html
 */
export function openPath(target) {
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [target], {detached: true, stdio: "ignore"}).unref();
}

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
