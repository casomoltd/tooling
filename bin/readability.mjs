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
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {
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
// Load optional per-repo config
// ---------------------------------------------------------------

async function loadConfig() {
  const cfgPath = path.join(
    PROJECT_ROOT,
    "readability.config.mjs",
  );
  if (!fs.existsSync(cfgPath)) return {};
  const mod = await import(pathToFileURL(cfgPath).href);
  return mod;
}

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

  const config = await loadConfig();

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
      pages.push({
        slug: s,
        wordCount: 0,
        scores: null,
        consensusGrade: null,
        pass: true,
        error: err.message,
      });
    }
  }

  const allPassed = pages.every((p) => p.pass);
  const threshold = {maxGrade};
  const results = {pages, threshold, allPassed};

  if (values.pretty) {
    console.error(formatPretty(results, threshold));
  }
  console.log(JSON.stringify(results, null, 2));

  process.exit(allPassed ? 0 : 1);
}

main();
