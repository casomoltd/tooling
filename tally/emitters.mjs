/**
 * How each kind of question becomes its input blocks, and each kind of
 * condition the body of Tally's conditional: one entry per kind, so a new
 * kind that has no entry fails to typecheck rather than writing nothing.
 */
import {RANGE_ENDS} from "./address.mjs";
import {answerRef, single} from "./fields.mjs";
import {
  BLOCK_TYPES, COMPARISONS, CONDITIONALS, DISABLED_DAYS,
} from "./vocabulary.mjs";

/** @import {
 *    Block, Condition, DateQuestion, MoneyQuestion, NumberQuestion, Question,
 *    Range,
 *  } from "./index.d.mts"
 *  @import {Conditional} from "./fields.mjs"
 *  @import {Translator} from "./translator.mjs" */

/**
 * How each kind of question becomes its input blocks.
 * @type {{[K in Question["kind"]]: (t: Translator,
 *   q: Extract<Question, {kind: K}>, hidden: boolean) => Block[]}}
 */
export const INPUTS = {
  text: (t, q, hidden) => [t.single(q, {
    ...base(q, hidden),
    ...(q.maxLength ? {hasMaxCharacters: true, maxCharacters: q.maxLength} : {}),
  })],
  email: (t, q, hidden) => [t.single(q, {
    ...base(q, hidden),
    ...(q.verify ? {requireVerification: true} : {}),
  })],
  longText: (t, q, hidden) => [t.single(q, {
    ...base(q, hidden),
    ...(q.placeholder ? {placeholder: q.placeholder} : {}),
  })],
  money: (t, q, hidden) => {
    const {currencyFormat, currencySymbol} = t.form.locale;
    // The question's own grey figure where it has one, else the symbol:
    // Tally draws the prefix only once a figure is typed, so an empty box
    // wouldn't say what it wants.
    return [t.single(q, {
      ...numberPayload(q, hidden),
      placeholder: q.placeholder ?? currencySymbol,
      format: currencyFormat,
      prefix: currencySymbol,
    })];
  },
  number: (t, q, hidden) => [t.single(q, numberPayload(q, hidden))],
  date: (t, q, hidden) =>
    [t.single(q, datePayload(q, hidden, t.form.locale.dateFormat))],
  choice: (t, q, hidden) => t.options(q, hidden, BLOCK_TYPES.ChoiceOption),
  dropdown: (t, q, hidden) => t.options(q, hidden, BLOCK_TYPES.DropdownOption),
  checkbox: (t, q, hidden) => t.options(q, hidden, BLOCK_TYPES.Checkbox),
};

/**
 * How each kind of condition becomes the body of Tally's conditional.
 * @type {{[K in Condition["kind"]]: (t: Translator,
 *   c: Extract<Condition, {kind: K}>, path: string) => Omit<Conditional, "uuid">}}
 */
export const CONDITIONS = {
  outside: (t, c, path) => {
    const answer = answerRef(t.at, t.number(c.question, path));
    return {
      type: CONDITIONALS.Group,
      payload: {
        logicalOperator: CONDITIONALS.Or,
        conditionals: [
          {uuid: t.at.block(t.at.rangeEnd(path, RANGE_ENDS.Below)),
            ...single(answer, COMPARISONS.LessThan, c.range.min)},
          {uuid: t.at.block(t.at.rangeEnd(path, RANGE_ENDS.Above)),
            ...single(answer, COMPARISONS.GreaterThan, c.range.max)},
        ],
      },
    };
  },
  answered: (t, c, path) =>
    single(t.fieldOf(c.question, path), COMPARISONS.IsNotEmpty, null),
  empty: (t, c, path) =>
    single(t.fieldOf(c.question, path), COMPARISONS.IsEmpty, null),
  chose: (t, c, path) => t.chose(c, path),
  dateBefore: (t, c, path) =>
    single(t.dateRef(c.question, path), COMPARISONS.IsBefore, c.date),
  dateAfter: (t, c, path) =>
    single(t.dateRef(c.question, path), COMPARISONS.IsAfter, c.date),
  dateBeforeAnswer: (t, c, path) =>
    single(t.dateRef(c.question, path), COMPARISONS.IsBefore, t.dateRef(c.other, path)),
  above: (t, c, path) =>
    single(t.calculated(c.calculation, path), COMPARISONS.GreaterThan, c.value),
  below: (t, c, path) =>
    single(t.calculated(c.calculation, path), COMPARISONS.LessThan, c.value),
  either: (t, c, path) => ({
    type: CONDITIONALS.Group,
    payload: {
      logicalOperator: CONDITIONALS.Or,
      conditionals: c.conditions.map((inner, i) =>
        t.conditional(inner, t.at.eitherOf(path, i))),
    },
  }),
};

/** @param {Question} question @param {boolean} hidden */
export function base(question, hidden) {
  return {isRequired: question.required, isHidden: hidden};
}

/** A number question's payload: Tally's own range check, unless the form
 *  words its own stop message instead.
 *  @param {MoneyQuestion | NumberQuestion} q @param {boolean} hidden */
function numberPayload(q, hidden) {
  return {
    ...base(q, hidden),
    ...(q.rangeMessage === undefined ? limits(q.range) : {}),
    ...(q.placeholder ? {placeholder: q.placeholder} : {}),
  };
}

/** @param {DateQuestion} q @param {boolean} hidden @param {string} format */
function datePayload(q, hidden, format) {
  return {
    ...base(q, hidden),
    format,
    ...(q.disable ? {disableDays: [DISABLED_DAYS[q.disable]]} : {}),
    ...(q.dateRange ? {dateRange: q.dateRange} : {}),
  };
}

/** @param {Range} range */
function limits(range) {
  return {
    hasMinNumber: true, minNumber: range.min,
    hasMaxNumber: true, maxNumber: range.max,
  };
}
