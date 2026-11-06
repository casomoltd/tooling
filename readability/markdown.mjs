/**
 * Markdown and MDX prose for the readability formulas: the blocks a reader
 * reads as running text, with markup, code and URLs taken out. A
 * newsletter post's gate (`buttondown/post-check.mjs`) and an MDX page's
 * readability check both read prose through this module.
 */
import fs from "node:fs";
import {FIGURE} from "./score.mjs";

/** The fence that opens and closes front matter, with its newline. */
export const FENCE = "---\n";
/** Front matter at a document's very start, its `key: value` lines captured:
 *  the one splitter a post and an MDX page are both read through. */
export const FRONT_MATTER = new RegExp(`^${FENCE}([\\s\\S]*?)\\n${FENCE}`);
/** The HTML elements a reader takes as a unit of their own. */
const BLOCK_END = /<\/(?:p|li|h[1-6]|figcaption|td|th|div|blockquote)>/gi;
/** A markdown line that stands alone: a heading, list item or table row. */
const BLOCK_LINE = /^[ \t]*(?:#+ |[-*+] |\d+\. |\|)/;
/** How a sentence ends, for the readability formulas. */
const ENDS_SENTENCE = /[.!?:;]\s*$/;
/** A block that isn't running prose: a heading, list, table, quote,
 *  caption or emphasis line, image or HTML block. */
const NOT_PARAGRAPH = /^(?:[#\-*+>|<!]|\d+\.)/;

/** An ESM block: MDX holds each import or export as a block of its own. */
const ESM_BLOCK = /^(?:import|export)\s/;
/** A figure an MDX page quotes from its facts, as `<Fact of={…} />`. */
const FACT = /<Fact\b[^>]*\/>/g;

/**
 * The running prose of an MDX page, for scoring: its paragraphs as plain
 * text. Front matter, imports, exports and comments are taken out and each
 * `<Fact />` reads as one short word, as a computed figure does on a TSX
 * page. As with a post, headings, list items and a component's own text are
 * not scored; a TSX page's extractor does read a component's prose props, so
 * the same words can grade differently in the two formats.
 */
export function extractMdxText(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const body = stripSpans(source.replace(FRONT_MATTER, ""), "{/*", "*/}")
    .split(/\n[ \t]*\n/)
    .filter((block) => !ESM_BLOCK.test(block.trim()))
    .join("\n\n")
    .replace(FACT, FIGURE);
  return proseOf(paragraphsOf(body));
}

/** The words a reader reads: markup, code and URLs taken out, link text
 *  and alt text kept. */
export function proseOf(markdown) {
  const blocks = endBlocks(withoutCode(stripSpans(markdown, "<!--", "-->")));
  return stripSpans(blocks, "<", ">")
    .replace(/\]\([^)\s]*\)/g, " ")
    .replace(/!?\[/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/^[ \t]*(?:#+|>|[-*+]|\d+\.|\|)/gm, "")
    .replace(/[*_|]/g, " ");
}

/** The body's paragraphs: the blank-line-separated blocks of running text.
 *  The formulas score sentences, and a caption or list item dense with
 *  figures and titles reads as a hard sentence when it isn't one. */
export function paragraphsOf(body) {
  return body.split(/\n[ \t]*\n/).map((block) => block.trim())
    .filter((block) => block && !NOT_PARAGRAPH.test(block))
    .join("\n\n");
}

/** `text` with fenced and inline code taken out. */
export function withoutCode(text) {
  return stripSpans(stripSpans(text, "```", "```"), "`", "`");
}

/** `text` with every span from `open` to the next `close` taken out. A
 *  scan rather than a lazy regex, which backtracks on an unclosed span. */
function stripSpans(text, open, close) {
  let out = "";
  let at = 0;
  for (let start = text.indexOf(open); start !== -1;
    start = text.indexOf(open, at)) {
    const end = text.indexOf(close, start + open.length);
    if (end === -1) break;
    out += `${text.slice(at, start)} `;
    at = end + close.length;
  }
  return out + text.slice(at);
}

/** Each block ended as a sentence, so the formulas don't read a list or a
 *  run of headings as one long sentence; a reader takes each on its own. */
function endBlocks(text) {
  return text.replace(BLOCK_END, ". ").split("\n")
    .map((line) => BLOCK_LINE.test(line) && !ENDS_SENTENCE.test(line)
      ? `${line}.` : line)
    .join("\n");
}
