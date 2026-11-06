/**
 * Readability scoring for prose, a Next.js page's or a newsletter post's: the
 * package's `./readability` export. Extracting a page's prose is `parser.mjs`;
 * scoring it is `score.mjs`.
 */

export {discoverSlugs, extractText} from "./parser.mjs";
export {
  DEFAULT_MAX_GRADE, DEFAULT_WORD_SUBS, FORMULAS, MIN_SCORABLE_WORDS, scoreText,
} from "./score.mjs";
