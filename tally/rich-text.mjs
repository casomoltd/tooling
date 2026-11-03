/**
 * Text as Tally stores it: `safeHTMLSchema`, a list of runs, each a string
 * with optional marks. Tally accepts the documented `html` but returns only
 * this, so sending this form is what lets a read-back compare like with like.
 */

/** @import {RichText, Styled, Text} from "./index.d.mts" */

/** @param {string} text @returns {string[][]} */
export function plainText(text) {
  return [[text]];
}

/**
 * Copy with marks, as runs: a marked run is `[text, [[mark, value], ...]]`,
 * the shape Tally stores a link (`["href", url]`), bold
 * (`["font-weight", "bold"]`) and italic (`["font-style", "italic"]`) in.
 * @param {Text} text
 * @returns {unknown[]}
 */
export function richText(text) {
  if (typeof text === "string") return plainText(text);
  return text.map((span) => typeof span === "string"
    ? [span]
    : [span.text, marksOf(span)]);
}

/** A setting's plain text, mentioning no answers.
 *  @param {string} text @returns {RichText} */
export function plainSetting(text) {
  return {safeHTMLSchema: plainText(text), mentions: []};
}

/** @param {Styled} span @returns {string[][]} */
function marksOf(span) {
  return [
    ...(span.href ? [["href", span.href]] : []),
    ...(span.bold ? [["font-weight", "bold"]] : []),
    ...(span.italic ? [["font-style", "italic"]] : []),
  ];
}
