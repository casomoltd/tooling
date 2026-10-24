/**
 * The house rules every repo's ESLint config shares: line length; the size
 * of a function, its parameter list, a file, its branching and nesting;
 * named numbers; no non-null assertions; and exhaustive switches. Both the
 * Next config (`index.mjs`) and the library config (`lib.mjs`) spread these
 * in, so each rule is stated once. Every rule is on unless a reason is
 * written beside the exception.
 *
 * They are errors, never warnings: a warning nobody has to act on is how a
 * module grows past what anyone can read. A file that already breaks one is
 * recorded in the repo's `eslint-suppressions.json` (`eslint
 * --suppress-all`), and `check-listed-files` fails a commit that touches it
 * until it is tidied, unless the message carries a `Lint-deferred:` reason.
 * A repo whose files are transcribed reference data (published tables,
 * cited at the data) exempts those paths from
 * `@typescript-eslint/no-magic-numbers` in its own config, saying why.
 * What each rule is for, and every exemption, is in `docs/lint.md`.
 */

/** Lines a function may run to, blank lines and comments not counted:
 *  ESLint's default. */
const FUNCTION_LINES = 50;
/** Parameters a function may take; past this, pass a value object.
 *  Proposed here; no external source (ESLint's default is 3). */
const PARAMS = 4;
/** Lines a file may run to, blank lines and comments not counted.
 *  Proposed here; no external source (ESLint's default is 300). */
const FILE_LINES = 400;
/** Cyclomatic complexity a function may reach. Proposed here; no external
 *  source (ESLint's default is 20). */
const COMPLEXITY = 10;

/** How deep blocks may nest before the code should be flattened.
 *  Proposed here; no external source (ESLint's default is 4). */
const DEPTH = 3;

const SKIP_BLANKS_AND_COMMENTS = { skipBlankLines: true, skipComments: true };

/** The rules, as one flat-config block for every file. */
export const HOUSE_RULES = {
  rules: {
    // URLs and regex literals are the deviations from 88: neither can be
    // broken without changing it. No other long line is allowed, so strings
    // and template literals are not exempt.
    'max-len': [
      'error',
      { code: 88, ignoreUrls: true, ignoreRegExpLiterals: true },
    ],
    'max-lines-per-function': [
      'error', { max: FUNCTION_LINES, ...SKIP_BLANKS_AND_COMMENTS },
    ],
    // The TypeScript version does not count a `this:` type annotation.
    'max-params': 'off',
    '@typescript-eslint/max-params': ['error', { max: PARAMS }],
    'max-lines': ['error', { max: FILE_LINES, ...SKIP_BLANKS_AND_COMMENTS }],
    complexity: ['error', COMPLEXITY],
    'max-depth': ['error', DEPTH],
    // A number in code is named, so the reader sees what it is. Counting
    // and indexing numbers, enums and type positions are not magic, nor a
    // parameter's default or a readonly class property, which already name
    // the number they hold. The TypeScript version replaces the base rule.
    'no-magic-numbers': 'off',
    '@typescript-eslint/no-magic-numbers': ['error', {
      ignore: [-1, 0, 1],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: true,
      ignoreTypeIndexes: true,
    }],
    // A `!` tells the compiler a value exists without checking that it does.
    '@typescript-eslint/no-non-null-assertion': 'error',
  },
};

/** Rules that need the type checker, for TypeScript files only. A switch
 *  over a union names every member, so a new member is a lint error at each
 *  switch rather than a silent fall-through. Type information also brings on the
 *  type-aware rules in sonarjs's recommended set, which are silent
 *  without it. */
export const TYPED_RULES = {
  files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
  // A declaration file holds no code to switch on.
  ignores: ['**/*.d.ts', '**/*.d.mts'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: { '@typescript-eslint/switch-exhaustiveness-check': 'error' },
};

/** A test file's cases often sit in one top-level function by design (a
 *  `describe` block, an assert script), and its expected figures are
 *  literals by design, so function length and magic numbers are not held
 *  against test files; every other limit is. */
export const TEST_FILES_EXEMPT = {
  files: [
    '**/*.test.*', '**/*.spec.*', '**/tests/**', '**/test/**', '**/__tests__/**',
  ],
  rules: {
    'max-lines-per-function': 'off',
    '@typescript-eslint/no-magic-numbers': 'off',
  },
};
