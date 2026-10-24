# Lint

Every consuming repo lints with one shared ESLint config, and every house rule
in it is an error. A file that broke a rule on the day the rule came in is put
on [the list](#the-list) instead of failing, and the list only shrinks: touching
a listed file is the moment it is tidied.

## The two configs

| Export | For | Built on |
|---|---|---|
| `@casomoltd/tooling/eslint` (`createBaseConfig`) | A Next.js app | `eslint-config-next`, SonarJS |
| `@casomoltd/tooling/eslint-lib` (`createLibConfig`) | A TypeScript library | `typescript-eslint`, SonarJS |

Both take the consumer's own resolved imports (the package has no dependencies
of its own) and spread in the same house rules from
[`eslint/house-rules.mjs`](../eslint/house-rules.mjs), so each rule and each
limit is stated once, there. This repo lints itself with the library config
([`eslint.config.mjs`](../eslint.config.mjs)).

## The house rules

| Rule | Why it is on |
|---|---|
| `max-len` | A line a reader can take in at once. URLs and regular-expression literals are the exemptions, because neither can be broken without changing it; a line holding any other string is held to the limit. |
| `max-lines-per-function`, `complexity`, `max-depth` | A function that does one thing, readable without scrolling. Past the limit it is doing several things that want a name each. |
| `@typescript-eslint/max-params` | Past the limit, the callers are passing a value object in pieces. |
| `max-lines` | A module a reader can hold in their head. |
| `@typescript-eslint/no-magic-numbers` | A number is named where it is defined, so the reader sees what it is. Counting numbers, array indexes, default values, enums, readonly class properties and type positions are not magic; the exact set is in `house-rules.mjs`. |
| `@typescript-eslint/no-non-null-assertion` | A `!` tells the compiler a value exists without checking that it does. |
| `@typescript-eslint/switch-exhaustiveness-check` | A switch over a union names every member, so adding one is a type error at each switch, not a silent fall-through. |

The limits themselves are in `house-rules.mjs`, each with its source or a note
that it is proposed there. The judgment half of the same standards (what a
function should be split into, what a name should say) is the [`typescript`
skill](../skills/typescript/SKILL.md)'s, and the [`code-review`
agent](../agents/code-review.md) holds those limits too wherever lint is
suppressed.

## Exemptions

- **Test files** (`**/*.test.*`, `**/*.spec.*`, and anything under a `tests/`,
  `test/` or `__tests__/` folder) are exempt from function length and magic
  numbers. A test file's cases often sit in one top-level function by design,
  and its expected figures are literals by design. Every other rule applies.
- **Declaration files** (`*.d.ts`, `*.d.mts`) are exempt from the typed rules:
  they hold no code to switch on.
- **Transcribed reference data**, per repo. A module that is a published table
  (a specification's constants, a standard's lookup values), cited at the data
  and pinned to a fixture, is exempt from `@typescript-eslint/no-magic-numbers`
  in that repo's own config, with the reason written beside the paths. Naming
  each entry of a published table says nothing the citation does not, and
  listing the file would refuse every future update to it.
- **Not switched on:** `sonarjs/nested-control-flow` duplicates `max-depth`;
  `no-restricted-imports` draws a boundary that only the repo can name, so a
  repo sets it in its own config.

### Where a deviation lives

A deliberate, permanent deviation (a rule a repo turns off for some paths, and
means to keep off) lives in that repo's ESLint config, as an override on the
narrowest paths, with the reason written beside it. That is the one place that
both enforces it and explains it, so the reason cannot drift from the rule,
and removing the override removes its reason with it. An override with no
reason beside it is a defect.

It never goes on [the list](#the-list). The list is lint debt that only
shrinks, so a permanent deviation there would be tidied away, or would make
the touch-it check refuse every future change to those files.

## Typed linting

`switch-exhaustiveness-check` needs the type checker, so the shared config turns
on `parserOptions.projectService` for `.ts`, `.tsx` and `.mts` files. Each such
file must then belong to a `tsconfig.json`. The library config also allows a
root `*.config.ts` as a default project, because a library's tsconfig includes
only its sources and tests; an app's tsconfig already includes its root config
files, and typescript-eslint refuses a file matched both ways. A file that
belongs to no tsconfig fails with *"was not found by the project service"*: add
it to the nearest tsconfig.

Type information also brings on the type-aware rules in SonarJS's recommended
set, which stay silent without it. Linting is slower with types on.

## The list

The list is ESLint's own suppressions file (ESLint 9.24 or later),
`eslint-suppressions.json` at the repo root ([ESLint: bulk
suppressions](https://eslint.org/docs/latest/use/suppressions)). It records, per
file and rule, how many violations were there when the rule came in. Lint then
reports only violations beyond those.

- **A new violation still fails**, in a listed file as in any other.
- **A fix must come off the list.** A file with fewer violations than its entry
  fails lint (*"There are suppressions left that do not occur anymore"*) until
  `eslint --prune-suppressions` removes the stale entry. A tidied file is
  therefore linted in full from then on.
- **Touching a listed file means tidying it.** The commit-msg hook runs
  [`check-listed-files`](../bin/check-listed-files.mjs), which refuses a commit
  that changes a file still on the staged list. Tidy the file in its own commit
  (fix it, then prune), and the change that needed it follows in code you can
  read. A rename counts under both its old and new path, and so does a deletion.
  A merge commit is not checked, since each branch was; an amend is checked on
  what it newly stages, not on the whole commit.
- **Deferring is explicit.** A commit that must change a listed file anyway
  carries a `Lint-deferred:` line saying why, and the check lets it through and
  names the file:

  ```text
  Lint-deferred: a one-line production fix; the tidy follows next
  ```

The check reads one list, at the repo root, keyed by root-relative path, which
is where ESLint writes it when run from the root. A tracked suppressions file
anywhere else fails every commit, since the check cannot hold; move it to the
root.

## Adopting a new rule

1. Land any purely mechanical fix on its own first. A repo with no list yet, or
   a fix that touches no listed file, is not held by the check.
2. Take the new tooling, then write the list: `npx eslint . --suppress-all`, and
   commit `eslint-suppressions.json` on its own.
3. From then on, each listed file is tidied the first time it is touched.
