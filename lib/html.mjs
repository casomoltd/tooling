/**
 * Markup helpers the checks share, so each reads a start tag, a character
 * reference and literal text the same way. Pure functions with no
 * dependency, as they ship to every consumer: a regex, not a parser, since
 * a parser would be an install for every repo that consumes this package.
 * `escapeRegExp` lives here rather than in `bin/utils.mjs` for the same
 * reason: `bin/utils.mjs` imports Node modules, and these are imported by
 * modules that must stay free of them. Consumers import them as
 * `@casomoltd/tooling/html`.
 */

/** The named references markup escapes with, and the typographic ones prose
 *  is written with, in the cases HTML accepts: `&apos;` and the typographic
 *  names have no upper-case form. Any other name is left as written. */
const NAMED = new Map([
  ["amp", "&"], ["AMP", "&"], ["quot", "\""], ["QUOT", "\""],
  ["lt", "<"], ["LT", "<"], ["gt", ">"], ["GT", ">"], ["apos", "'"],
  ["nbsp", "\u00A0"], ["lsquo", "\u2018"], ["rsquo", "\u2019"],
  ["ldquo", "\u201C"], ["rdquo", "\u201D"], ["ndash", "\u2013"],
  ["mdash", "\u2014"], ["hellip", "\u2026"],
]);
const HEX = 16;
const DECIMAL = 10;
/** What a browser reads a numeric reference to no character as. */
const REPLACEMENT = "\uFFFD";
const MAX_CODE_POINT = 0x10_FFFF;
const SURROGATE_START = 0xD8_00;
const SURROGATE_END = 0xDF_FF;

/** Where a start tag opens, and its name. */
const TAG_OPEN = /<([a-z][\w-]*)/gi;
/** One attribute of a start tag, read from where the last one ended: the
 *  whitespace or `/` HTML allows between attributes (none after a closing
 *  quote, as a minifier writes it), its name, and its value double-quoted,
 *  single-quoted or bare. Sticky, so a tag is read attribute by attribute
 *  and a quoted value may hold `<`, `>`, `=` or `id=`. A name or a bare
 *  value stops at `<`, so a tag left open never reads into the next. */
const ATTRIBUTE = new RegExp(String.raw`[\s/]*([^\s"'<>/=]+)`
  + String.raw`(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?`, "y");
/** What closes a start tag, read from where its last attribute ended. */
const TAG_CLOSE = /[\s/]*>/y;

/**
 * `text` with its character references read back: `&amp; &quot; &lt; &gt;
 * &apos;`, the typographic `&nbsp; &lsquo; &rsquo; &ldquo; &rdquo; &ndash;
 * &mdash; &hellip;`, and any numeric one, decimal or hex (React's server render
 * writes `&#x27;` for an apostrophe). Windows-1252 remapping of `&#128;` to
 * `&#159;` is not done.
 * @param {string} text
 */
export function decodeEntities(text) {
  return text.replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g,
    /** @param {string} ref @param {string | undefined} hex
     *  @param {string | undefined} dec @param {string | undefined} name */
    (ref, hex, dec, name) => {
      if (name !== undefined) return NAMED.get(name) ?? ref;
      return fromCode(hex === undefined
        ? Number.parseInt(dec ?? "", DECIMAL) : Number.parseInt(hex, HEX));
    });
}

/**
 * `text` with every character a regular expression reads as syntax
 * escaped, so a pattern built around it matches it literally: a page's id
 * or a link's address or text. `RegExp.escape` does this from Node 24 and
 * an ES2025 lib; this package sets no Node floor, so it keeps its own.
 * @param {string} text
 */
export function escapeRegExp(text) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Every start tag in `html`: its name, each attribute's name, lower
 * case, and value, its references read back (undefined for an attribute
 * written without one; only the first of a repeated name is kept), and
 * where the tag starts and ends in `html`. One forward pass: a tag is
 * read from where the last one closed, so a tag written inside a quoted
 * value (`alt="<b id=z>"`) is not one, and the scan stays linear. A `<`
 * that no `>` closes is not a tag, and the scan resumes one character
 * on, so in `<a foo <b id=x>` the tag is `<b id=x>`. A comment or a
 * script's string is read as markup, since a regex can't tell them
 * apart.
 * @param {string} html
 * @returns {{name: string, attributes: {name: string, value?: string}[],
 *   start: number, end: number}[]}
 */
export function startTags(html) {
  const tags = [];
  TAG_OPEN.lastIndex = 0;
  for (let open = TAG_OPEN.exec(html); open; open = TAG_OPEN.exec(html)) {
    const {attributes, end} = attributesFrom(html, open.index + open[0].length);
    const close = readAt(TAG_CLOSE, html, end);
    if (close) {
      tags.push({name: open[1].toLowerCase(), attributes,
        start: open.index, end: TAG_CLOSE.lastIndex});
    }
    TAG_OPEN.lastIndex = close ? TAG_CLOSE.lastIndex : open.index + 1;
  }
  return tags;
}

/** The attributes read from `at` on, and where the last one ended.
 *  @param {string} html @param {number} at */
function attributesFrom(html, at) {
  /** @type {{name: string, value?: string}[]} */
  const attributes = [];
  let end = at;
  for (let match = readAt(ATTRIBUTE, html, end); match;
    match = readAt(ATTRIBUTE, html, end)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    // A repeated name is dropped, as the HTML tokenizer drops it.
    if (!attributes.some((a) => a.name === name)) {
      attributes.push({name,
        ...(value === undefined ? {} : {value: decodeEntities(value)})});
    }
    end = ATTRIBUTE.lastIndex;
  }
  return {attributes, end};
}

/** A sticky pattern's match at `at`, or null.
 *  @param {RegExp} pattern @param {string} text @param {number} at */
function readAt(pattern, text, at) {
  pattern.lastIndex = at;
  return pattern.exec(text);
}

/** The character a numeric reference names; `&#0;`, a surrogate and a code
 *  point past Unicode's last read as U+FFFD, as a browser reads them.
 *  @param {number} code */
const fromCode = (code) =>
  code === 0 || code > MAX_CODE_POINT
    || (code >= SURROGATE_START && code <= SURROGATE_END)
    ? REPLACEMENT : String.fromCodePoint(code);
