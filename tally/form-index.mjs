/**
 * The uuids of a form's blocks, by what they are, for a site's styling that
 * targets them. Built once per form, so each lookup reads one map rather than
 * searching the pages again.
 */
import {Paths} from "./address.mjs";
import {hasOptions, isQuestion, uniqueBy} from "./fields.mjs";
import {rulesOf} from "./translator.mjs";

/** @import {FormDefinition, Question} from "./index.d.mts" */

export class FormIndex {
  /** @param {Pick<FormDefinition, "key" | "pages">} form */
  constructor(form) {
    /** @readonly */
    this.formKey = form.key;
    /** @readonly */
    this.at = new Paths(form.key);
    /** @readonly @type {Map<string, Question>} */
    this.questions = uniqueBy(
      form.pages.flatMap((p) => p.items).filter(isQuestion), "question");
    /** @readonly */
    this.stops = form.pages.flatMap(rulesOf)
      .filter((r) => r.kind === "reject")
      .map((r) => this.at.block(this.at.messageOf(r.key)));
  }

  /** @param {string} questionKey */
  title(questionKey) {
    return this.at.block(this.at.titleOf(this.question(questionKey).key));
  }

  /** @param {string} questionKey */
  input(questionKey) {
    return this.at.block(this.at.inputOf(this.question(questionKey).key));
  }

  /** @param {string} questionKey @param {string} optionKey */
  option(questionKey, optionKey) {
    const question = this.question(questionKey);
    if (!hasOptions(question) || !question.options.some((o) => o.key === optionKey)) {
      throw new Error(`${this.formKey} has no option ${questionKey}/${optionKey}`);
    }
    return this.at.option(questionKey, optionKey);
  }

  /** @param {string} questionKey */
  options(questionKey) {
    const question = this.question(questionKey);
    if (!hasOptions(question)) throw new Error(`${questionKey} has no options`);
    return question.options.map((o) => this.at.option(questionKey, o.key));
  }

  /** @param {string} questionKey */
  questionBlocks(questionKey) {
    const question = this.question(questionKey);
    // Tally draws each choice or checkbox option as a block of its own, but a
    // dropdown's options as one block classed by its group's uuid, the
    // answer's. An options question lists both, so either kind is reached.
    const inputs = hasOptions(question)
      ? [this.at.answer(question.key), ...this.options(questionKey)]
      : [this.input(questionKey)];
    return [
      this.title(questionKey),
      ...(question.help ? [this.at.block(this.at.helpText(question.key))] : []),
      ...inputs,
    ];
  }

  stopMessages() {
    return [...this.stops];
  }

  /** @param {string} key */
  question(key) {
    const question = this.questions.get(key);
    if (!question) throw new Error(`${this.formKey} has no question ${key}`);
    return question;
  }
}
