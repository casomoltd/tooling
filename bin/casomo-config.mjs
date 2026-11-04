/**
 * A repo's `casomo.config.mjs`: the one file every gate and engine reads its
 * settings from, each under its own key. The bins, the Buttondown engine and
 * the Tally engine all read it here.
 */

import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

/** The keys a repo's `casomo.config.mjs` may hold, one per gate. */
export const CASOMO_CONFIG_KEYS = Object.freeze(/** @type {const} */ ({
  buttondown: "buttondown",
  personalData: "personalData",
  privateRefs: "privateRefs",
  routes: "routes",
  tally: "tally",
}));

/** A key a gate reads its settings under.
 *  @typedef {(typeof CASOMO_CONFIG_KEYS)[keyof typeof CASOMO_CONFIG_KEYS]}
 *  CasomoConfigKey */

/** The files each gate read before `casomo.config.mjs`, by the key their
 *  settings now go under. A repo still holding one would have its settings
 *  ignored, so their presence fails the run. */
const RETIRED_CONFIGS = {
  "check-personal-data.config.mjs": CASOMO_CONFIG_KEYS.personalData,
  "check-private-refs.config.mjs": CASOMO_CONFIG_KEYS.privateRefs,
};

/**
 * Load an optional per-repo config file from `dir` (the working directory by
 * default): the module, or `{}` where there is no file. The file-level loader
 * under `loadCasomoConfig`, which is where a gate's settings belong; a tool
 * still reading its own `<tool>.config.mjs` (`readability`) calls this.
 * @param {string} filename
 * @param {string} [dir]
 */
export async function loadConfig(filename, dir = process.cwd()) {
  const cfgPath = path.join(dir, filename);
  if (!fs.existsSync(cfgPath)) return {};
  return import(pathToFileURL(cfgPath).href);
}

/**
 * One gate's settings from the repo's `casomo.config.mjs`, by the key it
 * reads: every gate a repo configures is configured in that one file, so a
 * repo carries one config rather than one per tool. An absent file or key
 * reads as no settings; a retired per-tool file, or a key no gate reads, is
 * refused, because either would otherwise read as no settings too and a
 * gate would pass on less than it was given.
 * @param {CasomoConfigKey} key
 * @param {string} [dir]
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
  /** @type {readonly string[]} */
  const known = Object.values(CASOMO_CONFIG_KEYS);
  const unknown = Object.keys(config).filter((k) => !known.includes(k));
  if (unknown.length) {
    throw new Error(`casomo.config.mjs holds ${unknown.join(", ")}, which no `
      + `gate reads; the keys are ${known.join(", ")}`);
  }
  return config[key] ?? {};
}
