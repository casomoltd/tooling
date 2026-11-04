/**
 * The public face of the signature entry. The code lives in rules.mjs,
 * where the typecheck reads it against the declaration here; beside a
 * .d.mts, TypeScript would skip it.
 */
export {
  attribute,
  DROPPED_MARKUP,
  escapeRegExp,
  EXPORT_SCALE,
  GMAIL_LIMIT,
  hrefs,
  imageTags,
  PNG_RGB,
  readPng,
} from "./rules.mjs";
