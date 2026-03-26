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

export function extractText(filePath) {
  const source = fs.readFileSync(filePath, "utf-8");

  const jsxText = [];
  const tagContentRe = />([^<>{]+)</g;
  let match;
  while ((match = tagContentRe.exec(source)) !== null) {
    const text = match[1].trim();
    if (text) jsxText.push(text);
  }

  // String literals that look like readable prose
  const stringRe = /['"`]([A-Z][^'"`]{20,})['"`]/g;
  while ((match = stringRe.exec(source)) !== null) {
    jsxText.push(match[1].trim());
  }

  // Terminate fragments so formulas count separate sentences
  const SENT_END = /[.!?]$/;
  const terminated = jsxText.map((t) =>
    SENT_END.test(t) ? t : t + "."
  );

  let text = terminated.join(" ");
  text = text.replace(/\{[^}]*\}/g, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&[a-z]+;/g, " ");
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

export function scoreText(text, wordSubs = DEFAULT_WORD_SUBS) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 100) {
    return {wordCount, scores: null, consensusGrade: null};
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
