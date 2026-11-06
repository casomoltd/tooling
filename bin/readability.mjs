#!/usr/bin/env node

/**
 * Measure reading difficulty of site pages from source files: each route's
 * `page.tsx`, with its `content.mdx` where it has one.
 *
 * Usage:
 *   npm run readability [-- slug] [-- --pretty] [-- --max-grade <n>]
 *
 * Arguments:
 *   slug        Optional path segment (e.g. "finance/mortgage-calculator").
 *               If omitted, all pages discovered in src/app/ are checked.
 *   --pretty    Print a human-readable table alongside JSON output.
 *   --max-grade Maximum consensus grade level; the repo's config, else the
 *               package default (DEFAULT_MAX_GRADE), when left out.
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
import {loadConfig} from "./casomo-config.mjs";
import {
  FORMULAS,
  MIN_SCORABLE_WORDS,
  discoverSlugs,
  routeText,
  scoreText,
  DEFAULT_MAX_GRADE,
  DEFAULT_WORD_SUBS,
} from "../readability/index.mjs";

const PROJECT_ROOT = process.cwd();
const SRC_APP = path.join(PROJECT_ROOT, "src", "app");

/** The width of a score column, and of the rule under a page's table. */
const SCORE_WIDTH = 6;
const TABLE_WIDTH = 44;

/** The width a row's label is padded to, so the score columns line up. */
const LABEL_WIDTH = 22;

/** The JSON on stdout is indented for a person reading a CI log. */
const JSON_INDENT = 2;

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  const options = await readOptions();
  const pages = options.slugs.map((s) => scorePage(s, options));
  const allPassed = pages.every((p) => p.pass);
  // Named separately from the pass/fail count. An unscored page is not
  // evidence of anything, and it should not be able to hide inside a
  // green run — the reader of this output has to be told how much of
  // the site was actually measured.
  const unscored = pages.filter((p) => p.unscored).map((p) => p.slug);
  const threshold = {maxGrade: options.maxGrade};
  report({pages, threshold, allPassed, unscored}, options.pretty);
  process.exit(allPassed ? 0 : 1);
}

/** The pages to score, the word substitutions and grade threshold, from the
 *  command line over the repo's config over the package defaults. */
async function readOptions() {
  const {values, positionals} = parseArgs({
    options: {
      pretty: {type: "boolean", default: false},
      "max-grade": {type: "string"},
    },
    allowPositionals: true,
  });
  const config = await loadConfig("readability.config.mjs");
  const slug = positionals[0];
  return {
    pretty: values.pretty,
    wordSubs: config.wordSubs ?? DEFAULT_WORD_SUBS,
    maxGrade:
      values["max-grade"] != null
        ? Number(values["max-grade"])
        : (config.maxGrade ?? DEFAULT_MAX_GRADE),
    slugs: slug ? [`/${slug.replace(/^\//, "")}`] : discoverSlugs(SRC_APP),
  };
}

/** One page's scores and whether it passes the threshold. */
function scorePage(slug, {wordSubs, maxGrade}) {
  try {
    const rel = slug === "/" ? "" : slug.slice(1);
    const text = routeText(path.join(SRC_APP, rel));
    const result = scoreText(text, wordSubs);
    const pass =
      result.consensusGrade == null || result.consensusGrade <= maxGrade;
    return {slug, ...result, pass};
  } catch (err) {
    // A page we could not read is a FAILURE, not a pass: a broken path or
    // an unreadable file must not report green, as an unscored page must
    // not.
    return {
      slug,
      wordCount: 0,
      scores: null,
      consensusGrade: null,
      pass: false,
      error: err.message,
    };
  }
}

/** The results as JSON on stdout, with the table and the unscored pages on
 *  stderr. */
function report(results, pretty) {
  if (pretty) {
    console.error(formatPretty(results));
  }
  console.log(JSON.stringify(results, null, JSON_INDENT));
  const {unscored} = results;
  if (unscored.length > 0) {
    console.error(
      `\nreadability: ${unscored.length} page(s) under `
      + `${MIN_SCORABLE_WORDS} words were NOT scored — they are not `
      + `passing, they are unmeasured:\n  ${unscored.join("\n  ")}`,
    );
  }
}

// ---------------------------------------------------------------
// Pretty-print a human-readable table
// ---------------------------------------------------------------

function pad(n) {
  return n == null ? "N/A" : String(n).padStart(SCORE_WIDTH);
}

/** One labelled row of a page's table. */
function row(label, value) {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`;
}

/** The results as a table per page, for a person reading `--pretty`. */
function formatPretty(results) {
  const lines = [];
  for (const r of results.pages) {
    lines.push(`\n${r.pass ? "PASS" : "FAIL"}  ${r.slug}`);
    lines.push("─".repeat(TABLE_WIDTH));
    if (!r.scores) {
      lines.push("  (too few words to score)");
      continue;
    }
    for (const f of FORMULAS) {
      lines.push(row(f.label, pad(r.scores[f.key])));
    }
    lines.push("─".repeat(TABLE_WIDTH));
    lines.push(row("Consensus Grade Level", pad(r.consensusGrade)));
    lines.push(row("Word Count", r.wordCount.toLocaleString()));
  }
  lines.push(
    `\nThreshold: grade ${results.threshold.maxGrade} | ` +
      `${results.allPassed ? "All passed" : "FAILURES DETECTED"}`,
  );
  return lines.join("\n");
}

main();
