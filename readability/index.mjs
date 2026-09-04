/**
 * Readability scoring for Next.js page content.
 *
 * Extracts prose from JSX source files and computes scores
 * against 7 readability formulas. Designed to be called from
 * the CLI wrapper or programmatically.
 */

import rs from "text-readability";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_MAX_GRADE = 12;

export const DEFAULT_WORD_SUBS = {
  calculators: "tools",
  calculator: "tool",
};

// -------------------------------------------------------------------
// Discover page slugs from an app-router directory
// -------------------------------------------------------------------

export function discoverSlugs(srcAppDir) {
  const entries = fs.readdirSync(srcAppDir, {recursive: true});
  return entries
    .filter((e) => e.endsWith("page.tsx"))
    .map((e) => {
      const dir = path.dirname(e);
      return dir === "." ? "/" : `/${dir}`;
    })
    .sort();
}

// -------------------------------------------------------------------
// Extract prose text from a page.tsx source file
// -------------------------------------------------------------------

/**
 * Resolve a project-local import specifier to a file on disk.
 *
 * Relative (`./x`) and src-aliased (`@/x`) only. A bare specifier is a
 * package and is deliberately not followed: node_modules prose is not
 * this site's prose.
 */
function resolveLocalImport(spec, fromFile, srcDir) {
  let base;
  if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else if (spec.startsWith("@/") && srcDir) {
    base = path.join(srcDir, spec.slice(2));
  } else {
    return null;
  }
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** The `src` directory a file sits under, for resolving `@/` imports. */
function srcDirOf(filePath) {
  const marker = `${path.sep}src${path.sep}`;
  const i = filePath.lastIndexOf(marker);
  return i === -1 ? null : filePath.slice(0, i + marker.length - 1);
}

const IMPORT_RE = /import\s+(?:type\s+)?(?:[\w*{},\s]+from\s+)?["']([^"']+)["']/g;

/** Prose lifted from ONE file's JSX, without following its imports. */
function extractOwnText(source) {
  const jsxText = [];

  // Tag content. `{` is ALLOWED inside the match and the expressions
  // are stripped further down. Excluding it dropped the whole sentence
  // rather than the interpolation, so any served line carrying a
  // figure — most of the prose on a pay page — was invisible here.
  const tagContentRe = /&gt;([^&lt;&gt;]+)&lt;/g;
  let match;
  while ((match = tagContentRe.exec(source)) !== null) {
    const text = match[1].replace(/\{[^}]*\}/g, " ").trim();
    if (text) jsxText.push(text);
  }

  // String literals that look like readable prose. "Look like" is
  // doing real work: an SVG `d` attribute begins with a capital M and
  // runs for thousands of characters, and counting one as a sentence
  // put a whole article three grades above its true score.
  const stringRe = /['"`]([A-Z][^'"`]{20,})['"`]/g;
  while ((match = stringRe.exec(source)) !== null) {
    const candidate = match[1].trim();
    if (isProse(candidate)) jsxText.push(candidate);
  }
  // NOT filtered as a whole: tag content is legitimately fragmentary,
  // because a formatter wraps one served sentence across several
  // lines. Only string literals need the prose test, and only they can
  // contain an SVG path.
  return jsxText;
}

/**
 * Whether a string is prose a reader would read, rather than data that
 * happens to live in a string.
 *
 * Two tests, both cheap. It must be mostly letters — path data,
 * class-name soup and number tables are not — and it must be more than
 * a couple of words, which drops the fragments left behind when a JSX
 * expression is stripped out of a short line.
 */
function isProse(text) {
  const compact = text.replace(/\s+/g, "");
  if (compact.length === 0) return false;
  const letters = (compact.match(/[A-Za-z]/g) ?? []).length;
  if (letters / compact.length < 0.6) return false;
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  return words.length >= 3;
}

/**
 * Prose a reader actually sees on a page, following the components it
 * imports.
 *
 * Import-following is the point. Until 3 Sep 2026 this read one file
 * and stopped, so every shared prose component was unmeasured — a
 * notice component scoring grade 12.6 while all five pages rendering
 * it reported PASS. A page's score has to cover what it renders, not
 * what happens to be written in its own file.
 *
 * Depth-limited and cycle-safe. Only project-local imports are
 * followed; a package's prose is not this site's prose.
 */
export function extractText(filePath, {maxDepth = 3} = {}) {
  const srcDir = srcDirOf(filePath);
  const seen = new Set();
  const collected = [];

  const walk = (file, depth) => {
    const resolved = path.resolve(file);
    if (seen.has(resolved) || depth > maxDepth) return;
    seen.add(resolved);
    const source = fs.readFileSync(resolved, "utf-8");
    collected.push(...extractOwnText(source));
    if (depth === maxDepth) return;
    for (const m of source.matchAll(IMPORT_RE)) {
      const target = resolveLocalImport(m[1], resolved, srcDir);
      if (target) walk(target, depth + 1);
    }
  };
  walk(filePath, 0);

  // Terminate fragments so formulas count separate sentences
  const SENT_END = /[.!?]$/;
  const terminated = collected.map((t) =>
    SENT_END.test(t) ? t : t + "."
  );

  let text = terminated.join(" ");
  text = text.replace(/\{[^}]*\}/g, " ");
  text = text.replace(/&amp;nbsp;/g, " ");
  text = text.replace(/&amp;amp;/g, "&amp;");
  text = text.replace(/&amp;lt;/g, "&lt;");
  text = text.replace(/&amp;gt;/g, "&gt;");
  text = text.replace(/&amp;[a-z]+;/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

// -------------------------------------------------------------------
// Compute readability scores
// -------------------------------------------------------------------

function round(n) {
  return Math.round(n * 10) / 10;
}

function applyWordSubs(text, wordSubs) {
  let out = text;
  for (const [word, sub] of Object.entries(wordSubs)) {
    out = out.replace(
      new RegExp(`\\b${word}\\b`, "gi"),
      sub,
    );
  }
  return out;
}

/**
 * The floor below which the formulas are not meaningful.
 *
 * A page under it is UNSCORED, not passing. The two used to be
 * indistinguishable — the CLI read a null grade as a pass — so eight
 * of forty-five pages were reported green on the strength of no
 * measurement at all.
 */
export const MIN_SCORABLE_WORDS = 100;

export function scoreText(text, wordSubs = DEFAULT_WORD_SUBS) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SCORABLE_WORDS) {
    return {
      wordCount,
      scores: null,
      consensusGrade: null,
      unscored: true,
    };
  }
  const normalized = applyWordSubs(text, wordSubs);
  const scores = {
    fleschReadingEase: round(
      rs.fleschReadingEase(normalized),
    ),
    fleschKincaidGrade: round(
      rs.fleschKincaidGrade(normalized),
    ),
    gunningFog: round(rs.gunningFog(normalized)),
    colemanLiau: round(rs.colemanLiauIndex(normalized)),
    smog: round(rs.smogIndex(normalized)),
    ari: round(
      rs.automatedReadabilityIndex(normalized),
    ),
    daleChall: round(
      rs.daleChallReadabilityScore(normalized),
    ),
  };
  const gradeScores = [
    scores.fleschKincaidGrade,
    scores.gunningFog,
    scores.colemanLiau,
    scores.smog,
    scores.ari,
  ];
  gradeScores.sort((a, b) => a - b);
  const consensusGrade = round(
    gradeScores[Math.floor(gradeScores.length / 2)],
  );
  return {wordCount, scores, consensusGrade};
}

// -------------------------------------------------------------------
// Pretty-print a human-readable table
// -------------------------------------------------------------------

function pad(n) {
  return n == null ? "N/A" : String(n).padStart(6);
}

export function formatPretty(results, threshold) {
  const lines = [];
  for (const r of results.pages) {
    const status = r.pass ? "PASS" : "FAIL";
    lines.push(`\n${status}  ${r.slug}`);
    lines.push("─".repeat(44));
    if (!r.scores) {
      lines.push("  (too few words to score)");
      continue;
    }
    lines.push(
      `  Flesch Reading Ease   ${pad(r.scores.fleschReadingEase)}`,
    );
    lines.push(
      `  Flesch-Kincaid Grade  ${pad(r.scores.fleschKincaidGrade)}`,
    );
    lines.push(
      `  Gunning Fog           ${pad(r.scores.gunningFog)}`,
    );
    lines.push(
      `  Coleman-Liau          ${pad(r.scores.colemanLiau)}`,
    );
    lines.push(
      `  SMOG                  ${pad(r.scores.smog)}`,
    );
    lines.push(
      `  ARI                   ${pad(r.scores.ari)}`,
    );
    lines.push(
      `  Dale-Chall            ${pad(r.scores.daleChall)}`,
    );
    lines.push("─".repeat(44));
    lines.push(
      `  Consensus Grade Level ${pad(r.consensusGrade)}`,
    );
    lines.push(
      `  Word Count            ${r.wordCount.toLocaleString()}`,
    );
  }
  lines.push(
    `\nThreshold: grade ${threshold.maxGrade} | ` +
      `${results.allPassed ? "All passed" : "FAILURES DETECTED"}`,
  );
  return lines.join("\n");
}
