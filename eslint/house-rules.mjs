/**
 * The house lint rules every repo's ESLint config shares. Both the Next
 * config (`index.mjs`) and the library config (`lib.mjs`) spread these in,
 * so each rule is stated once.
 */

/** The rules, as one flat-config block for every file. */
export const HOUSE_RULES = {
  rules: {
    // URLs are the one deviation from 88: they are a pain to break. No other
    // long line is allowed, so strings and template literals are not exempt.
    'max-len': [
      'error',
      { code: 88, ignoreUrls: true, ignoreRegExpLiterals: true },
    ],
  },
};
