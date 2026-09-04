#!/usr/bin/env node

/**
 * Measure reading difficulty of site pages from source files.
 *
 * Usage:
 *   npm run readability [-- slug] [-- --pretty] [-- --max-grade <n>]
 *
 * Arguments:
 *   slug        Optional path segment (e.g. "finance/mortgage-calculator").
 *               If omitted, all pages discovered in src/app/ are checked.
 *   --pretty    Print a human-readable table alongside JSON output.
 *   --max-grade Maximum consensus grade level (default: 12).
 *
 * Per-repo config:
 *   Place a readability.config.mjs in the project root to override
 *   defaults. Exports: wordSubs (object), maxGrade (number).
 *
 * Exit codes:
 *   0  All pages pass the grade threshold
 *   1  One or more pages exceed the threshold
 */

import {parseArgs} from "node:util";
import path from "node:path";
import {loadConfig} from "./utils.mjs";
import {
  MIN_SCORABLE_WORDS,
  discoverSlugs,
  extractText,
  scoreText,
  formatPretty,
  DEFAULT_MAX_GRADE,
  DEFAULT_WORD_SUBS,
} from "../readability/index.mjs";

const PROJECT_ROOT = process.cwd();
const SRC_APP = path.join(PROJECT_ROOT, "src", "app");

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  const {values, positionals} = parseArgs({
    options: {
      pretty: {type: "boolean", default: false},
      "max-grade": {type: "string"},
    },
    allowPositionals: true,
  });

  const config = await loadConfig("readability.config.mjs");

  const wordSubs = config.wordSubs ?? DEFAULT_WORD_SUBS;
  const maxGrade =
    values["max-grade"] != null
      ? Number(values["max-grade"])
      : (config.maxGrade ?? DEFAULT_MAX_GRADE);

  const slug = positionals[0];
  const slugs = slug
    ? [`/${slug.replace(/^\//, "")}`]
    : discoverSlugs(SRC_APP);

  const pages = [];
  for (const s of slugs) {
    try {
      const rel = s === "/" ? "" : s.slice(1);
      const filePath = path.join(SRC_APP, rel, "page.tsx");
      const text = extractText(filePath);
      const result = scoreText(text, wordSubs);
      const pass =
        result.consensusGrade == null ||
        result.consensusGrade <= maxGrade;
      pages.push({slug: s, ...result, pass});
    } catch (err) {
      // A page we could not read is a FAILURE, not a pass. Recording
      // it as passing meant a broken path or an unreadable file
      // reported green, which is the same shape of blind spot as
      // treating an unscored page as a pass.
      pages.push({
        slug: s,
        wordCount: 0,
        scores: null,
        consensusGrade: null,
        pass: false,
        error: err.message,
      });
    }
  }

  const allPassed = pages.every((p) => p.pass);
  // Named separately from the pass/fail count. An unscored page is not
  // evidence of anything, and it should not be able to hide inside a
  // green run — the reader of this output has to be told how much of
  // the site was actually measured.
  const unscored = pages.filter((p) => p.unscored).map((p) => p.slug);
  const threshold = {maxGrade};
  const results = {pages, threshold, allPassed, unscored};

  if (values.pretty) {
    console.error(formatPretty(results, threshold));
  }
  console.log(JSON.stringify(results, null, 2));

  if (unscored.length > 0) {
    console.error(
      `\nreadability: ${unscored.length} page(s) under `
      + `${MIN_SCORABLE_WORDS} words were NOT scored — they are not `
      + `passing, they are unmeasured:\n  ${unscored.join("\n  ")}`,
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main();
