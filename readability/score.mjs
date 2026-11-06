/**
 * Readability scores for a text against seven formulas, and the consensus grade
 * they give. Where page text comes from is `parser.mjs`'s.
 */

import rs from "text-readability";

export const DEFAULT_MAX_GRADE = 12;

export const DEFAULT_WORD_SUBS = {
  calculators: "tools",
  calculator: "tool",
};

/**
 * The floor below which the formulas are not meaningful.
 *
 * A page under it is UNSCORED, not passing: a score that measured
 * nothing is not evidence the page reads well.
 */
export const MIN_SCORABLE_WORDS = 100;

/** Scores are reported to one decimal place. */
const ONE_DECIMAL = 10;

/** Halving, for the middle index of a list. */
const HALF = 2;

/**
 * The seven formulas, in the order a page's scores are reported: each one's
 * key in `scores`, its label in a table, its function, and whether it gives
 * a grade level and so counts towards the consensus grade.
 */
export const FORMULAS = Object.freeze([
  {key: "fleschReadingEase", label: "Flesch Reading Ease",
    score: (t) => rs.fleschReadingEase(t), grade: false},
  {key: "fleschKincaidGrade", label: "Flesch-Kincaid Grade",
    score: (t) => rs.fleschKincaidGrade(t), grade: true},
  {key: "gunningFog", label: "Gunning Fog",
    score: (t) => rs.gunningFog(t), grade: true},
  {key: "colemanLiau", label: "Coleman-Liau",
    score: (t) => rs.colemanLiauIndex(t), grade: true},
  {key: "smog", label: "SMOG",
    score: (t) => rs.smogIndex(t), grade: true},
  {key: "ari", label: "ARI",
    score: (t) => rs.automatedReadabilityIndex(t), grade: true},
  {key: "daleChall", label: "Dale-Chall",
    score: (t) => rs.daleChallReadabilityScore(t), grade: false},
]);

/**
 * The text's word count, its score on each formula and the consensus grade,
 * the median of the grade-level formulas. Under MIN_SCORABLE_WORDS it is
 * `unscored`, with no scores. Each word in `wordSubs` is scored as the word
 * it maps to.
 */
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
  const scores = Object.fromEntries(
    FORMULAS.map((f) => [f.key, round(f.score(normalized))]),
  );
  const gradeScores = FORMULAS.filter((f) => f.grade).map((f) => scores[f.key]);
  const consensusGrade = round(median(gradeScores));
  return {wordCount, scores, consensusGrade};
}

function round(n) {
  return Math.round(n * ONE_DECIMAL) / ONE_DECIMAL;
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

/** The middle value; for an even count, the upper of the two middles. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / HALF)];
}
