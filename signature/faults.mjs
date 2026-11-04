/**
 * The checks every Casomo signature passes, run as one: a site's test hands
 * over its signature and its own facts (where its images live, its colophon)
 * and asserts the list comes back empty. A failing check names itself in the
 * list rather than stopping the rest, so one run shows every fault. What only
 * one site's signature carries (its links, its people) stays in that site's
 * test.
 *
 * Its types are index.d.mts.
 */

import {readdirSync, readFileSync} from "node:fs";
import {basename, dirname, join} from "node:path";
import {
  attribute, DROPPED_MARKUP, escapeRegExp, EXPORT_SCALE, GMAIL_LIMIT,
  imageTags, PNG_RGB, readPng,
} from "./rules.mjs";

/** @import {Header, SignatureFacts} from "./index.d.mts" */
/** @import {ColophonLine} from "../identity/index.d.mts" */

/** The header whose value decides how long a client keeps an image. */
const CACHE_HEADER = "cache-control";

/** The least an image's cache may last: a day, long enough that a reply
 *  thread doesn't refetch it. */
const MIN_IMAGE_CACHE_SECONDS = 86_400;

/**
 * Every rule a signature breaks, each named; empty when it keeps them all.
 * @param {SignatureFacts} facts
 * @returns {string[]}
 */
export function signatureFaults(facts) {
  const {html, colophon, linkSources} = facts;
  const faults = [];
  if (html.length >= GMAIL_LIMIT) {
    faults.push(`${html.length} characters, over Gmail's ${GMAIL_LIMIT}`);
  }
  for (const markup of DROPPED_MARKUP) {
    if (html.includes(markup)) faults.push(`uses ${markup}, which a client drops`);
  }
  const images = imageTags(html);
  faults.push(...imageFaults(images, facts));
  for (const line of colophon) {
    if (!new RegExp(colophonShape(line, linkSources)).test(html)) {
      faults.push(`lacks the colophon line "${line.text}"`);
    }
  }
  return faults;
}

/**
 * What is wrong with the headers a signature's images are served with: none
 * matched, no cache header, too short a life (a reply thread refetches them)
 * or `immutable` (a changed image never reaches a reader). Undefined when
 * they are right.
 * @param {readonly Header[] | undefined} headers
 * @returns {string | undefined}
 */
export function cacheFault(headers) {
  if (headers === undefined) return "no header rule matches the images' folder";
  const cacheControl = headers
    .find(({key}) => key.toLowerCase() === CACHE_HEADER)?.value;
  if (cacheControl === undefined) return "the images have no Cache-Control";
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1]);
  if (Number.isNaN(maxAge) || maxAge < MIN_IMAGE_CACHE_SECONDS) {
    return `max-age under a day: ${cacheControl}`;
  }
  if (cacheControl.includes("immutable")) {
    return `immutable, so a changed image never arrives: ${cacheControl}`;
  }
  return undefined;
}

/**
 * The image rules: served from the site's folder, every file in it used,
 * each held at twice its display size with no alpha, and each with the alt
 * text and `border="0"` Outlook needs.
 * @param {string[]} images @param {SignatureFacts} facts
 */
function imageFaults(images, {origin, imagesPath, imagesDir}) {
  const faults = [];
  /** @type {string[]} */
  const used = [];
  for (const tag of images) {
    // Each image is its own boundary: one that can't be read (no src, a
    // missing attribute, a file that isn't there or isn't a PNG) is one
    // fault in the list, and the other checks still run.
    try {
      const src = new URL(attribute(tag, "src"));
      if (src.origin !== origin || dirname(src.pathname) !== imagesPath) {
        faults.push(`${src} is not served from ${origin}${imagesPath}`);
        continue;
      }
      const name = basename(src.pathname);
      used.push(name);
      faults.push(...oneImageFaults(tag, name, readFileSync(join(imagesDir, name))));
    } catch (error) {
      faults.push(`${tag} can't be checked: ${
        error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const file of readdirSync(imagesDir)) {
    if (!used.includes(file)) faults.push(`${file} is in the folder but unused`);
  }
  return faults;
}

/**
 * One image's own rules: twice its display size, no alpha, alt text and the
 * border Outlook needs.
 * @param {string} tag @param {string} name @param {Uint8Array} bytes
 */
function oneImageFaults(tag, name, bytes) {
  const faults = [];
  const png = readPng(bytes);
  const width = Number(attribute(tag, "width")) * EXPORT_SCALE;
  const height = Number(attribute(tag, "height")) * EXPORT_SCALE;
  if (png.width !== width || png.height !== height) {
    faults.push(`${name} is ${png.width}×${png.height}, not ${width}×${height}`);
  }
  if (png.colourType !== PNG_RGB) faults.push(`${name} is not flattened to RGB`);
  if (attribute(tag, "alt").trim() === "") faults.push(`${name} has no alt text`);
  if (attribute(tag, "border") !== "0") faults.push(`${name} lacks border="0"`);
  return faults;
}

/**
 * The markup a colophon line takes: a register line names its number as a
 * link to the register; a line with a source links its text where the site
 * links sources, and otherwise reads as a sentence.
 * @param {ColophonLine} line
 * @param {boolean} linkSources
 */
function colophonShape(line, linkSources) {
  if ("register" in line) {
    return `${escapeRegExp(line.text)} `
      + `<a href="${escapeRegExp(line.register.url)}"[^>]*>`
      + `${escapeRegExp(line.register.number)}</a>`;
  }
  return linkSources
    ? `<a href="${escapeRegExp(line.source)}"[^>]*>${escapeRegExp(line.text)}</a>`
    : `${escapeRegExp(line.text)}\\.`;
}
