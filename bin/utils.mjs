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
 * Load an optional per-repo config file from `dir` (the working directory by
 * default): the module, or `{}` where there is no file. The file-level loader
 * under `loadCasomoConfig`, which is where a gate's settings belong; a tool
 * still reading its own `<tool>.config.mjs` (`readability`) calls this.
 */
export async function loadConfig(filename, dir = process.cwd()) {
  const cfgPath = path.join(dir, filename);
  if (!fs.existsSync(cfgPath)) return {};
  return import(pathToFileURL(cfgPath).href);
}

/** The keys a repo's `casomo.config.mjs` may hold, one per gate. */
export const CASOMO_CONFIG_KEYS = {
  personalData: "personalData",
  privateRefs: "privateRefs",
};

/** The files each gate read before `casomo.config.mjs`, by the key their
 *  settings now go under. A repo still holding one would have its settings
 *  ignored, so their presence fails the run. */
const RETIRED_CONFIGS = {
  "check-personal-data.config.mjs": CASOMO_CONFIG_KEYS.personalData,
  "check-private-refs.config.mjs": CASOMO_CONFIG_KEYS.privateRefs,
};

/**
 * One gate's settings from the repo's `casomo.config.mjs`, by the key it
 * reads: every gate a repo configures is configured in that one file, so a
 * repo carries one config rather than one per tool. An absent file or key
 * reads as no settings; a retired per-tool file, or a key no gate reads, is
 * refused, because either would otherwise read as no settings too and a
 * gate would pass on less than it was given.
 */
export async function loadCasomoConfig(key, dir = process.cwd()) {
  for (const [file, moveTo] of Object.entries(RETIRED_CONFIGS)) {
    if (fs.existsSync(path.join(dir, file))) {
      throw new Error(`${file} is no longer read: move its settings under `
        + `\`${moveTo}\` in casomo.config.mjs and delete it`);
    }
  }
  const mod = await loadConfig("casomo.config.mjs", dir);
  // The settings are the module's default export; the module object itself
  // holds no gate key and would read as no settings.
  const config = mod?.default ?? {};
  const known = Object.values(CASOMO_CONFIG_KEYS);
  const unknown = Object.keys(config).filter((k) => !known.includes(k));
  if (unknown.length) {
    throw new Error(`casomo.config.mjs holds ${unknown.join(", ")}, which no `
      + `gate reads; the keys are ${known.join(", ")}`);
  }
  return config[key] ?? {};
}
