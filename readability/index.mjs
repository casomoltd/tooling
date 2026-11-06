/**
 * Readability scoring for prose, a Next.js page's or a newsletter post's: the
 * package's `./readability` export. Extracting a TSX page's prose is
 * `parser.mjs`, an MDX page's or a post's is `markdown.mjs`; scoring it is
 * `score.mjs`.
 */

export {discoverSlugs, extractText, routeText} from "./parser.mjs";
export {extractMdxText} from "./markdown.mjs";
export {
  DEFAULT_MAX_GRADE, DEFAULT_WORD_SUBS, FORMULAS, MIN_SCORABLE_WORDS, scoreText,
} from "./score.mjs";
