/**
 * A site's half of the engine, read from `tally` in its casomo.config.mjs:
 * where its forms, their ids, the last-push record and its form stylesheet
 * live, which of its design tokens the stylesheet copies, and where the
 * account's API key comes from. Every path to a site file is resolved
 * against the site, never against this package; the key file is the account's
 * own, under its home or absolute.
 */
import {readFile, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {CASOMO_CONFIG_KEYS, loadCasomoConfig} from "../lib/casomo-config.mjs";
import {uniqueBy} from "./fields.mjs";

/** @import {FormDefinition} from "./index.d.mts" */

/** The indent the id registry is written with, so a new id is a one-line
 *  diff. */
const JSON_INDENT = 2;

/** Where the API key is read from when the config names no variable. */
const DEFAULT_KEY_ENV = "TALLY_API_KEY";

/** The settings that have no default: each is a place in the site. */
const REQUIRED = ["forms", "registry", "pushed", "globals", "stylesheet"];

/**
 * The site's settings, every path absolute. Throws where one is missing,
 * since it would otherwise be guessed.
 * @param {string} root
 */
export async function loadTallySettings(root = process.cwd()) {
  const config = await loadCasomoConfig(CASOMO_CONFIG_KEYS.tally, root);
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`casomo.config.mjs needs tally.${missing.join(", tally.")}`);
  }
  /** @param {string} p */
  const at = (p) => inSite(root, p);
  return {
    root,
    forms: at(config.forms),
    registry: at(config.registry),
    pushed: at(config.pushed),
    globals: at(config.globals),
    stylesheet: at(config.stylesheet),
    /** @type {readonly (readonly [string, string])[]} */
    tokens: config.tokens ?? [],
    apiKeyEnv: config.apiKeyEnv ?? DEFAULT_KEY_ENV,
    /** The file holding a key kept per account, as written in the config, or
     *  undefined for none. */
    apiKeyFile: apiKeyFileOf(config.apiKeyFile),
  };
}

/**
 * The API key: the file `apiKeyFile` names, where this account has one, else
 * the variable `apiKeyEnv` names.
 * @param {Pick<TallySiteSettings, "apiKeyEnv" | "apiKeyFile">} settings
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function tallyApiKey(settings, env = process.env) {
  const file = settings.apiKeyFile?.replace(/^~(?=\/)/, os.homedir());
  const fromFile = file ? await readKeyFile(file) : undefined;
  if (fromFile) return fromFile;
  const fromEnv = env[settings.apiKeyEnv];
  if (!fromEnv) {
    const where = file ? `${file} is absent and ` : "";
    throw new Error(`${where}${settings.apiKeyEnv} is not set`);
  }
  return fromEnv;
}

/** @typedef {Awaited<ReturnType<typeof loadTallySettings>>} TallySiteSettings */

/**
 * The site's forms, by key: its forms module's `forms` export.
 * @param {TallySiteSettings} settings
 * @returns {Promise<Map<string, FormDefinition>>}
 */
export async function loadForms(settings) {
  const mod = await import(pathToFileURL(settings.forms).href);
  if (!Array.isArray(mod.forms)) {
    throw new Error(`${settings.forms} must export forms, an array of forms`);
  }
  /** @type {FormDefinition[]} */
  const forms = mod.forms;
  // Two forms under one key would share a Tally id and a push record.
  return uniqueBy(forms, "form");
}

/**
 * The site's form-id registry, for a reader that needs only the ids; or
 * undefined for a site that keeps no Tally forms. A `tally` block without a
 * registry is a mistake in the config, refused, as loadTallySettings
 * refuses it.
 * @param {string} [root]
 */
export async function loadTallyRegistry(root = process.cwd()) {
  const config = await loadCasomoConfig(CASOMO_CONFIG_KEYS.tally, root);
  // No `tally` block, or an empty one, is a site that keeps no forms.
  const keepsNoForms = Object.keys(config).length === 0;
  if (keepsNoForms) return undefined;
  if (!config.registry) throw new Error("casomo.config.mjs needs tally.registry");
  return formRegistry(inSite(root, config.registry));
}

/**
 * The record of each form's Tally id, by form key, in the site's registry
 * file: written on a form's first push, read by every later one and by the
 * site's own pages that embed it.
 * @param {string} file
 */
export function formRegistry(file) {
  /** No file yet reads as no ids: the first push writes it.
   *  @returns {Promise<Record<string, string>>} */
  const read = async () => {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      const {code} = /** @type {NodeJS.ErrnoException} */ (error);
      if (code === "ENOENT") return {};
      throw error;
    }
  };
  return {
    /** The id of a form already created, or undefined for a new one.
     *  @param {string} formKey */
    async maybeIdOf(formKey) {
      return (await read())[formKey];
    },
    /** @param {string} formKey */
    async idOf(formKey) {
      const id = (await read())[formKey];
      if (!id) throw new Error(`${formKey} has not been pushed yet`);
      return id;
    },
    /** Every form's id, by form key. */
    async ids() {
      return read();
    },
    /** @param {string} formKey @param {string} id */
    async record(formKey, id) {
      const ids = {...await read(), [formKey]: id};
      await writeFile(file, `${JSON.stringify(ids, null, JSON_INDENT)}\n`);
    },
  };
}

/**
 * A path from the site's config, resolved against the site, never against
 * this package.
 * @param {string} root @param {string} p
 */
function inSite(root, p) {
  return path.resolve(root, p);
}

/**
 * The key in an account's key file, or undefined where the account has none.
 * A file that is there but empty or unreadable is refused: it marks an account
 * holding a key of wider reach than the variable's, which a push must not
 * quietly swap for the narrower one.
 * @param {string} file the key file, its `~/` already expanded; refused unless
 *   absolute, since it belongs to the account and not the site
 */
async function readKeyFile(file) {
  if (!path.isAbsolute(file)) {
    throw new Error(`tally.apiKeyFile must start with ~/ or /, not ${file}`);
  }
  try {
    const key = (await readFile(file, "utf8")).trim();
    if (!key) throw new Error(`${file} is empty`);
    return key;
  } catch (error) {
    // No file is an account that keeps its key in the variable.
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * The `apiKeyFile` setting: a non-empty string, or absent. Anything else is
 * refused, since a blank would quietly fall back to the variable.
 * @param {unknown} value
 */
function apiKeyFileOf(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value) {
    throw new Error("tally.apiKeyFile must be a non-empty path");
  }
  return value;
}
