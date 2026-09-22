/**
 * Shared helpers for CLI bin scripts.
 */

import {spawn} from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {pathToFileURL} from "node:url";

/**
 * Usable width inside a design spec's figure card, in px.
 *
 * Read off `styles/casomo-spec.css`, which sets no `box-sizing`, so every
 * width there is a CONTENT width:
 *
 *   --measure: 62rem      .wrap's content box          992
 *   .figure-card padding  16px each side               -32
 *   .figure-card border   1px each side                 -2
 *                                                      ---
 *                                                      958
 *
 * One producer, because the renderer reports a figure against this and the
 * checker fails a spec over it; two copies are two answers at the boundary.
 * It mirrors a stylesheet, so a change to `--measure` or to the card's
 * padding is a change to this number.
 */
export const FIGURE_WIDTH_BUDGET = 958;

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
