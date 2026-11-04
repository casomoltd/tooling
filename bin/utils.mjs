/**
 * Helpers the bins and the hooks share: the entry-point check, the platform
 * opener and a design spec's figure-width budget. A repo's
 * `casomo.config.mjs` is read by casomo-config.mjs.
 */

import {spawn} from "node:child_process";
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
 * @param {string} target
 */
export function openPath(target) {
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [target], {detached: true, stdio: "ignore"}).unref();
}

/**
 * Whether the module at `moduleUrl` is the one node was started with. npm
 * installs a bin as a symlink, and a plugin's hooks may be reached through
 * one, so `process.argv[1]` is the link while
 * `import.meta.url` is the target it resolves to: resolve before comparing,
 * or the entry point never runs. A module a test imports has no matching
 * `argv[1]`, and is not the entry point.
 * @param {string} moduleUrl
 */
export function isEntryPoint(moduleUrl) {
  const started = process.argv[1];
  if (!started) return false;
  return moduleUrl === pathToFileURL(fs.realpathSync(started)).href;
}

