/**
 * A site's half of the engine, read from `tally` in its casomo.config.mjs:
 * where its forms, their ids, the last-push record and its form stylesheet
 * live, and which of its design tokens the stylesheet copies. Every path is
 * resolved against the site, never against this package.
 */
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {CASOMO_CONFIG_KEYS, loadCasomoConfig} from "../bin/utils.mjs";
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
  const at = (p) => path.resolve(root, p);
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
  };
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
    /** @param {string} formKey @param {string} id */
    async record(formKey, id) {
      const ids = {...await read(), [formKey]: id};
      await writeFile(file, `${JSON.stringify(ids, null, JSON_INDENT)}\n`);
    },
  };
}
