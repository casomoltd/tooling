/**
 * The public face of the signature entry: two code files, rules.mjs and
 * faults.mjs, behind one name. Their types are index.d.mts.
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
export {cacheFault, signatureFaults} from "./faults.mjs";
