/**
 * What an email signature has to be to survive a mail client: the rules a
 * signature pasted into Gmail and read in Outlook (whose Word engine
 * re-serialises it on every reply) must keep, and the readers a site's test
 * uses to hold its own signature to them. A site keeps its own facts (its
 * file, its images' folder, its links); the rules live here, so two sites'
 * signatures are held to the same ones.
 *
 * Plain functions with no test framework, so any runner can use them. Its
 * types are index.d.mts.
 */

import {startTags} from "../lib/html.mjs";

/** A re-export of `@casomoltd/tooling/html`'s `escapeRegExp`, its home, so a
 *  signature test needs one import. */
export {escapeRegExp} from "../lib/html.mjs";

/** @import * as Signature from "./index.d.mts" */

/** Gmail's limit on a signature's length
 *  (https://support.google.com/mail/answer/8395). */
export const GMAIL_LIMIT = 10_000;

/** Markup an email client drops or Outlook's Word engine ignores, so a
 *  signature that uses it breaks on a reply. */
export const DROPPED_MARKUP = Object.freeze([
  "data:", "<svg", "border-radius", "letter-spacing", "<style", "class=",
]);

/** Each image is exported at twice its display size, for sharp screens. */
export const EXPORT_SCALE = 2;

/** PNG colour type 2, RGB with no alpha: a client that ignores transparency
 *  draws the image as it was flattened. */
export const PNG_RGB = 2;

/** The bytes every PNG starts with
 *  (https://www.w3.org/TR/png-3/#5PNG-file-signature). */
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

/** Where the header chunk's width, height and colour type sit: after the
 *  8-byte signature and the chunk's length and type
 *  (https://www.w3.org/TR/png-3/#11IHDR). */
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;
const COLOUR_TYPE_OFFSET = 25;

/**
 * Every `<img>` tag in a signature, whole, as the shared tag reader finds
 * it, so a `>` in a quoted value doesn't cut it short.
 * @param {string} html
 */
export function imageTags(html) {
  return startTags(html).filter((tag) => tag.name === "img")
    .map(({start, end}) => html.slice(start, end));
}

/**
 * Every link's address in a signature, its entities read back.
 * @param {string} html
 */
export function hrefs(html) {
  return startTags(html).flatMap(({attributes}) => attributes
    .flatMap(({name, value}) => (name === "href" && value !== undefined
      ? [value] : [])));
}

/**
 * A tag's attribute, read by the shared tag reader, its entities read
 * back; throws where the tag has none or gives it no value, since a
 * signature's image without its width or alt is the fault being looked
 * for.
 * @param {string} tag @param {string} name
 */
export function attribute(tag, name) {
  const value = startTags(tag)[0]?.attributes
    .find((a) => a.name === name.toLowerCase())?.value;
  if (value === undefined) throw new Error(`${tag} has no ${name}`);
  return value;
}

/**
 * A PNG's size and colour type, read from its header; throws on a file that
 * isn't a PNG.
 * @param {Uint8Array} bytes
 * @returns {Signature.PngHeader}
 */
export function readPng(bytes) {
  const data = Buffer.from(bytes);
  if (!data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("not a PNG");
  }
  return {
    width: data.readUInt32BE(WIDTH_OFFSET),
    height: data.readUInt32BE(HEIGHT_OFFSET),
    colourType: data[COLOUR_TYPE_OFFSET],
  };
}
