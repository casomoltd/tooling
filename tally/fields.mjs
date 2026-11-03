/**
 * What the translator and the settings both read off a form: its items by
 * key, and the references Tally reads an answer through.
 */
import {CONDITIONALS, FIELD_REF_TYPES, QUESTION_TYPES} from "./vocabulary.mjs";

/** @import {
 *    Comparison, FieldRef, FormDefinition, Item, OptionsQuestion, Question,
 *  } from "./index.d.mts"
 *  @import {Paths} from "./address.mjs" */

/**
 * One condition inside a logic block, as Tally spells it.
 * @typedef {{uuid: string,
 *   type: (typeof CONDITIONALS)["Single" | "Group"],
 *   payload: Record<string, unknown>}} Conditional
 */

/** Read against the record of question kinds, so a new non-question kind
 *  cannot pass as a question.
 *  @param {Item} item @returns {item is Question} */
export function isQuestion(item) {
  return item.kind in QUESTION_TYPES;
}

/** @param {Question} question @returns {question is OptionsQuestion} */
export function hasOptions(question) {
  return question.kind === "choice" || question.kind === "dropdown"
    || question.kind === "checkbox";
}

/** The item a key names, on any page.
 *  @param {Pick<FormDefinition, "pages">} form @param {string} key */
export function itemByKey(form, key) {
  return form.pages.flatMap((p) => p.items).find((i) => i.key === key);
}

/**
 * A reference to a question's answer, as a condition, a calculation or an
 * email's mention reads it.
 * @param {Paths} at
 * @param {Question} question
 * @returns {FieldRef}
 */
export function answerRef(at, question) {
  const group = at.answer(question.key);
  return {
    uuid: group,
    type: FIELD_REF_TYPES.Input,
    questionType: QUESTION_TYPES[question.kind],
    blockGroupUuid: group,
    title: question.title,
  };
}

/** One comparison of one field, as Tally's SINGLE conditional.
 *  @param {FieldRef} field @param {Comparison} comparison
 *  @param {unknown} value @returns {Omit<Conditional, "uuid">} */
export function single(field, comparison, value) {
  return {type: CONDITIONALS.Single, payload: {field, comparison, value}};
}

/**
 * Each thing by its key, refusing a key used twice: two things under one key
 * would share uuids, and Tally would keep only one of them.
 * @template {{key: string}} T
 * @param {T[]} things
 * @param {string} what
 * @param {string} [field] what the key is, for the message
 * @returns {Map<string, T>}
 */
export function uniqueBy(things, what, field = "key") {
  /** @type {Map<string, T>} */
  const byKey = new Map();
  for (const thing of things) {
    if (byKey.has(thing.key)) {
      throw new Error(`Two ${what}s share the ${field} ${thing.key}`);
    }
    byKey.set(thing.key, thing);
  }
  return byKey;
}
