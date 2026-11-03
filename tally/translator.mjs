/**
 * A form, described as pages of questions and rules, translated into the
 * `blocks` array Tally's API takes.
 *
 * Two layers on purpose. A form is written as a `FormDefinition`: pages of
 * questions, each with a stable key and, where it applies, the answers that
 * show it, plus page rules (jump, reject, ratio). This module is the only
 * place that knows how Tally spells that: a title block and input blocks per
 * question, an option block per choice, and a logic block per condition. The
 * shapes follow the API's `POST /forms` schema and the blocks Tally's own
 * editor writes, read back with `GET /forms/{id}`; where Tally departs from
 * its reference, `docs/tally.md` § Undocumented behaviour says how.
 *
 * Every block's uuid is derived from the form key and a path within it rather
 * than generated. Tally keys answers, Sheet columns and logic by uuid, so a
 * form pushed twice must carry the same uuids both times, or every push would
 * orphan the answers already collected.
 */
import {CONDITIONS, INPUTS, base} from "./emitters.mjs";
import {
  answerRef, hasOptions, isQuestion, single, uniqueBy,
} from "./fields.mjs";
import {Paths} from "./address.mjs";
import {plainText, richText} from "./rich-text.mjs";
import {
  ACTION_TYPES, BLOCK_TYPES, CALCULATION, COMPARISONS, CONDITIONALS,
  FIELD_REF_TYPES, GROUP_TYPES, NO_BADGE, QUESTION_TYPES,
} from "./vocabulary.mjs";

export {toSettings} from "./settings.mjs";

/** @import {
 *    Block, BlockType, Condition, DateQuestion, FieldRef, FormDefinition,
 *    GroupType, HiddenFields, Item, Jump, MoneyQuestion, NumberQuestion,
 *    OptionsQuestion, Page, Question, Ratio, Reject, Rule, Text,
 *  } from "./index.d.mts"
 *  @import {Conditional} from "./fields.mjs" */

/** One action inside a logic block, before its uuid is assigned.
 *  @typedef {{type: string, payload?: Record<string, unknown>}} Action */

/** One block to write: where it sits, its name, and what it holds.
 *  @typedef {{path: string, label: string, type: BlockType,
 *    groupType: GroupType, payload: Record<string, unknown>}} BlockSpec */

/** Holds one form's lookups while its blocks are written, and the name of
 *  every block it writes. */
export class Translator {
  /** @param {FormDefinition} form */
  constructor(form) {
    /** @readonly */
    this.form = form;
    /** @readonly */
    this.at = new Paths(form.key);
    /** Each block's name, by uuid, as it is written.
     *  @readonly @type {Map<string, string>} */
    this.names = new Map();
    const items = form.pages.flatMap((p) => p.items);
    const rules = form.pages.flatMap(rulesOf);
    /** @readonly @type {Map<string, Question>} */
    this.questions = uniqueBy(items.filter(isQuestion), "question");
    // A question's title is its column in the form's Sheet, so two questions
    // under one title would share a column.
    const titles = [...this.questions.values()].map((q) => ({key: q.title}));
    uniqueBy(titles, "question", "title");
    uniqueBy(items.filter((i) => i.kind === "note"), "note");
    const hiddenItems = /** @type {HiddenFields[]} */ (
      items.filter((i) => i.kind === "hiddenFields"));
    uniqueBy(hiddenItems, "hidden-fields item");
    /** Each hidden field, by its name, with the item that holds it.
     *  @readonly @type {Map<string, HiddenFields>} */
    this.hidden = new Map();
    for (const item of hiddenItems) {
      for (const name of item.fields) {
        // A field's name is how conditions find it, so it must not be shared
        // with another field or with a question's key.
        if (this.hidden.has(name) || this.questions.has(name)) {
          throw new Error(`Two fields share the name ${name}`);
        }
        this.hidden.set(name, item);
      }
    }
    uniqueBy(rules, "rule");
    /** @readonly @type {Map<string, Ratio>} */
    this.ratios = new Map(rules
      .filter((r) => r.kind === "ratio")
      .map((r) => [r.key, /** @type {Ratio} */ (r)]));
    /** @readonly */
    this.pageIndex = new Map([...uniqueBy(form.pages, "page").keys()]
      .map((key, i) => [key, i]));
  }

  /** @returns {Block[]} */
  blocks() {
    /** @type {Block[]} */
    const out = [this.formTitle()];
    const thankYou = this.form.thankYou ?? [];
    const breaks = this.form.pages.length - 1 + (thankYou.length > 0 ? 1 : 0);
    const lastBreak = breaks - 1;
    this.form.pages.forEach((page, index) => {
      if (index > 0) out.push(this.pageBreak(page, index - 1, lastBreak));
      if (page.title) out.push(this.pageTitle(page, page.title));
      out.push(...this.page(page));
    });
    if (thankYou.length > 0) {
      out.push(this.thankYouBreak(lastBreak));
      for (const n of thankYou) {
        out.push(this.text(n.key, n.text, false, `${n.key} note`));
      }
    }
    return out;
  }

  /** A page's ratios, then its items, then its jumps and stops.
   *  @param {Page} page @returns {Block[]} */
  page(page) {
    const rules = rulesOf(page);
    /** @type {Block[]} */
    const out = [];
    // A ratio is worked out before anything on the page reads it.
    for (const rule of rules) if (rule.kind === "ratio") out.push(...this.ratio(rule));
    for (const item of page.items) {
      if (item.showWhen) out.push(this.showLogic(item, item.showWhen));
      out.push(...this.item(item));
    }
    for (const rule of rules) {
      if (rule.kind === "jump") out.push(this.jump(rule));
      if (rule.kind === "reject") out.push(...this.reject(rule));
    }
    return out;
  }

  /** One block at a path, in a group of its own, with its name.
   *  @param {BlockSpec} spec @returns {Block} */
  block({path, label, type, groupType, payload}) {
    return this.emit({
      uuid: this.at.block(path), groupUuid: this.at.group(path),
      label, type, groupType, payload,
    });
  }

  /** Any block, recording its name: the one place a block is built.
   *  @param {Omit<BlockSpec, "path"> & {uuid: string, groupUuid: string}} spec
   *  @returns {Block} */
  emit({uuid, groupUuid, label, type, groupType, payload}) {
    this.names.set(uuid, label);
    return {uuid, type, groupUuid, groupType, payload};
  }

  formTitle() {
    // The first page's button is set here: a page break sets only the button
    // of the page after it.
    return this.block({
      path: this.at.formTitle(), label: "form title",
      type: BLOCK_TYPES.FormTitle, groupType: BLOCK_TYPES.Text,
      payload: {
        title: this.form.title, safeHTMLSchema: plainText(this.form.title),
        button: {label: this.form.pageButton},
      },
    });
  }

  /** The button that carries the respondent on from the page before.
   *  @param {Page} page @param {number} index @param {number} last */
  pageBreak(page, index, last) {
    return this.block({
      path: this.at.pageBreakOf(page.key), label: `page break before ${page.key}`,
      type: BLOCK_TYPES.PageBreak, groupType: BLOCK_TYPES.PageBreak,
      payload: {
        index, isFirst: index === 0, isLast: index === last,
        button: {label: this.form.pageButton},
      },
    });
  }

  /** The break that opens the page shown after Submit. @param {number} index */
  thankYouBreak(index) {
    return this.block({
      path: this.at.thankYouBreak(), label: "thank-you page break",
      type: BLOCK_TYPES.PageBreak, groupType: BLOCK_TYPES.PageBreak,
      payload: {index, isFirst: index === 0, isLast: true, isThankYouPage: true},
    });
  }

  /** @param {Page} page @param {string} title */
  pageTitle(page, title) {
    return this.block({
      path: this.at.pageTitleOf(page.key), label: `${page.key} page title`,
      type: BLOCK_TYPES.Heading2, groupType: BLOCK_TYPES.Heading2,
      payload: {safeHTMLSchema: plainText(title)},
    });
  }

  /** @param {string} key @param {Text} text @param {boolean} hidden
   *  @param {string} label */
  text(key, text, hidden, label) {
    return this.textAt(this.at.textOf(key), text, hidden, label);
  }

  /** @param {string} path @param {Text} text @param {boolean} hidden
   *  @param {string} label */
  textAt(path, text, hidden, label) {
    return this.block({
      path, label,
      type: BLOCK_TYPES.Text, groupType: BLOCK_TYPES.Text,
      payload: {safeHTMLSchema: richText(text), isHidden: hidden},
    });
  }

  /** @param {Item} item @returns {Block[]} */
  item(item) {
    if (item.kind === "note") {
      return [this.text(item.key, item.text, item.showWhen !== undefined,
        `${item.key} note`)];
    }
    if (item.kind === "hiddenFields") return [this.hiddenFields(item)];
    return this.question(item);
  }

  /** @param {HiddenFields} item */
  hiddenFields(item) {
    return this.block({
      path: this.at.hiddenOf(item.key), label: `${item.key} hidden fields`,
      type: BLOCK_TYPES.HiddenFields, groupType: BLOCK_TYPES.HiddenFields,
      payload: {
        hiddenFields: item.fields.map((name) =>
          ({uuid: this.at.hiddenField(item.key, name), name})),
      },
    });
  }

  /** A question's title, its help line if any, then its input blocks.
   *  @param {Question} question @returns {Block[]} */
  question(question) {
    const hidden = question.showWhen !== undefined;
    const title = this.block({
      path: this.at.titleOf(question.key), label: `${question.key} title`,
      type: BLOCK_TYPES.Title, groupType: GROUP_TYPES.Question,
      payload: {safeHTMLSchema: plainText(question.title), isHidden: hidden},
    });
    const help = question.help
      ? [this.textAt(this.at.helpText(question.key), question.help, hidden,
        `${question.key} help`)]
      : [];
    // A mapped type can't carry the correlation between a question's kind
    // and its emitter, so the lookup is widened here and nowhere else.
    const inputsOf = /** @type {(t: Translator, q: Question, hidden: boolean) =>
      Block[]} */ (INPUTS[question.kind]);
    return [title, ...help, ...inputsOf(this, question, hidden)];
  }

  /**
   * Every group an item owns. A rule naming only the input leaves the title
   * on screen when the answer says it should go, so all of them are named.
   * @param {Item} item @returns {string[]}
   */
  groupsOf(item) {
    if (item.kind === "note") return this.hiddenNote(this.at.textOf(item.key));
    if (item.kind === "hiddenFields") {
      return [this.at.group(this.at.hiddenOf(item.key))];
    }
    const help = this.at.helpText(item.key);
    return [
      this.at.group(this.at.titleOf(item.key)),
      ...(item.help ? [this.at.group(help)] : []),
      this.at.answer(item.key),
    ];
  }

  /** What a rule names to show a hidden note: its block beside its group, or
   *  Tally never shows it (docs/tally.md § Undocumented behaviour).
   *  @param {string} path the note's text path */
  hiddenNote(path) {
    return [this.at.group(path), this.at.block(path)];
  }

  /** @param {Item} item @param {Condition[]} when */
  showLogic(item, when) {
    const showBlocks = this.groupsOf(item);
    return this.logic(this.at.showOf(item.key), `${item.key} show logic`, when,
      [{type: ACTION_TYPES.ShowBlocks, payload: {showBlocks}}]);
  }

  /** @param {Jump} rule */
  jump(rule) {
    const target = this.pageIndex.get(rule.to);
    if (target === undefined) throw new Error(`${rule.key}: no page ${rule.to}`);
    const jumpToPage = tallyPageNumber(target);
    return this.logic(rule.key, `${rule.key} logic`, rule.when,
      [{type: ACTION_TYPES.JumpToPage, payload: {jumpToPage}}]);
  }

  /** The message, hidden until the conditions hold, then the logic that
   *  shows it. @param {Reject} rule */
  reject(rule) {
    return [
      this.textAt(this.at.messageOf(rule.key), rule.message, true,
        `${rule.key} message`),
      this.logic(rule.key, `${rule.key} logic`, rule.when, [
        {type: ACTION_TYPES.ShowBlocks,
          payload: {showBlocks: this.hiddenNote(this.at.messageOf(rule.key))}},
        // Tally refuses a payload on this action, even an empty one.
        {type: ACTION_TYPES.HideButton},
      ]),
    ];
  }

  /**
   * The calculated field, then the logic that fills it once both answers are
   * in: assign the numerator, divide by the denominator.
   * @param {Ratio} rule
   */
  ratio(rule) {
    const field = this.calculated(rule.key, rule.key);
    const holder = this.block({
      path: this.at.calcOf(rule.key), label: `${rule.key} calculation`,
      type: BLOCK_TYPES.CalculatedFields, groupType: BLOCK_TYPES.CalculatedFields,
      payload: {
        calculatedFields: [
          {uuid: this.at.calcField(rule.key), name: rule.name, type: CALCULATION.Number,
            value: 0},
        ],
      },
    });
    const steps = [
      {operator: CALCULATION.Assign, question: rule.numerator},
      {operator: CALCULATION.Divide, question: rule.denominator},
    ];
    /** @type {Condition[]} */
    const when = steps.map((s) => ({kind: "answered", question: s.question}));
    const actions = steps.map((s) => ({
      type: ACTION_TYPES.Calculate,
      payload: {
        calculate: {
          field, operator: s.operator, value: this.numberOf(s.question, rule.key),
        },
      },
    }));
    return [holder, this.logic(rule.key, `${rule.key} logic`, when, actions)];
  }

  /** @param {string} path @param {string} label @param {Condition[]} when
   *  @param {Action[]} actions */
  logic(path, label, when, actions) {
    return this.block({
      path: this.at.logicOf(path), label,
      type: BLOCK_TYPES.Logic, groupType: BLOCK_TYPES.Logic,
      payload: {
        updateUuid: null,
        logicalOperator: CONDITIONALS.And,
        conditionals: when.map((c, i) =>
          this.conditional(c, this.at.conditionOf(path, i))),
        actions: actions.map((a, i) =>
          ({uuid: this.at.block(this.at.actionOf(path, i)), ...a})),
      },
    });
  }

  /** @param {Condition} c @param {string} path @returns {Conditional} */
  conditional(c, path) {
    // As with inputs, the kind-to-emitter correlation is widened once, here.
    const bodyOf = /** @type {(t: Translator, c: Condition, path: string) =>
      Omit<Conditional, "uuid">} */ (CONDITIONS[c.kind]);
    return {uuid: this.at.block(path), ...bodyOf(this, c, path)};
  }

  /** @param {import("./index.d.mts").Chose} c @param {string} path */
  chose(c, path) {
    const question = this.withOptions(c.question, path);
    for (const option of c.options) {
      if (!question.options.some((o) => o.key === option)) {
        throw new Error(`${path}: ${c.question} has no option ${option}`);
      }
    }
    const values = c.options.map((o) => this.at.option(c.question, o));
    // Tally refuses IS on a checkbox or dropdown question, so either is
    // always read as IS_ANY_OF, even for one option.
    const answer = answerRef(this.at, question);
    // The one case Tally accepts IS for.
    const singleChoice = question.kind === "choice" && values.length === 1;
    return singleChoice
      ? single(answer, COMPARISONS.Is, values[0])
      : single(answer, COMPARISONS.IsAnyOf, values);
  }

  /** A hidden field's value, as a condition or calculation reads it.
   *  @param {string} name @param {HiddenFields} item @returns {FieldRef} */
  hiddenRef(name, item) {
    return {
      uuid: this.at.hiddenField(item.key, name),
      type: FIELD_REF_TYPES.Hidden,
      questionType: BLOCK_TYPES.HiddenFields,
      blockGroupUuid: this.at.group(this.at.hiddenOf(item.key)),
      title: name,
    };
  }

  /** A question's answer or a hidden field's value, by its key or name.
   *  @param {string} key @param {string} path */
  fieldOf(key, path) {
    const item = this.hidden.get(key);
    return item ? this.hiddenRef(key, item) : answerRef(this.at, this.find(key, path));
  }

  /** A number to calculate with: a number question, or a hidden field, whose
   *  value the embedding page writes as a number.
   *  @param {string} key @param {string} path */
  numberOf(key, path) {
    const item = this.hidden.get(key);
    return item
      ? this.hiddenRef(key, item)
      : answerRef(this.at, this.number(key, path));
  }

  /** @param {string} key @param {string} path */
  dateRef(key, path) {
    return answerRef(this.at, this.date(key, path));
  }

  /** @param {string} key @param {string} path @returns {FieldRef} */
  calculated(key, path) {
    const ratio = this.ratios.get(key);
    if (!ratio) throw new Error(`${path}: no calculation ${key}`);
    return {
      uuid: this.at.calcField(key),
      type: FIELD_REF_TYPES.Calculated,
      questionType: BLOCK_TYPES.CalculatedFields,
      blockGroupUuid: this.at.group(this.at.calcOf(key)),
      title: ratio.name,
      calculatedFieldType: CALCULATION.Number,
    };
  }

  /** @param {string} key @param {string} path */
  find(key, path) {
    const question = this.questions.get(key);
    if (!question) throw new Error(`${path}: no question ${key}`);
    return question;
  }

  /** @param {string} key @param {string} path @returns {OptionsQuestion} */
  withOptions(key, path) {
    const question = this.find(key, path);
    if (!hasOptions(question)) throw new Error(`${path}: ${key} offers no options`);
    return question;
  }

  /** @param {string} key @param {string} path @returns {DateQuestion} */
  date(key, path) {
    const question = this.find(key, path);
    if (question.kind !== "date") throw new Error(`${path}: ${key} is not a date`);
    return question;
  }

  /** @param {string} key @param {string} path
   *  @returns {MoneyQuestion | NumberQuestion} */
  number(key, path) {
    const question = this.find(key, path);
    if (question.kind !== "money" && question.kind !== "number") {
      throw new Error(`${path}: ${key} is not a number`);
    }
    return question;
  }

  /** A question answered in one input block.
   *  @param {Question} question @param {Record<string, unknown>} payload */
  single(question, payload) {
    const type = QUESTION_TYPES[question.kind];
    return this.emit({
      uuid: this.at.block(this.at.inputOf(question.key)),
      groupUuid: this.at.answer(question.key),
      label: `${question.key} input`,
      type: /** @type {BlockType} */ (type),
      groupType: type,
      payload,
    });
  }

  /** A choice or checkbox question: one block per option, sharing one group.
   *  @param {OptionsQuestion} question @param {boolean} hidden
   *  @param {BlockType} type @returns {Block[]} */
  options(question, hidden, type) {
    const last = question.options.length - 1;
    const plain = !this.form.settings.badges && question.kind === "choice";
    return question.options.map((option, index) => this.emit({
      uuid: this.at.option(question.key, option.key),
      groupUuid: this.at.answer(question.key),
      label: `${question.key} option ${option.key}`,
      type,
      groupType: QUESTION_TYPES[question.kind],
      payload: {
        ...base(question, hidden),
        index,
        isFirst: index === 0,
        isLast: index === last,
        text: option.label,
        // Tally reads the badge setting from the first option only.
        ...(index === 0 && plain ? {hasBadge: false, badgeType: NO_BADGE} : {}),
      },
    }));
  }
}

/** @param {FormDefinition} form @returns {Block[]} */
export function toBlocks(form) {
  return translate(form).blocks;
}

/** @param {FormDefinition} form @returns {(uuid: string) => string} */
export function blockNames(form) {
  return translate(form).name;
}

/**
 * A form's blocks and a name for each, from one pass: the name is recorded as
 * the block is written, so the two can't disagree.
 * @param {FormDefinition} form
 */
export function translate(form) {
  const translator = new Translator(form);
  const blocks = translator.blocks();
  const names = translator.names;
  /** @param {string} uuid */
  const name = (uuid) => names.get(uuid) ?? `unknown block ${uuid}`;
  return {blocks, name};
}

/** @param {Page} page @returns {Rule[]} */
export function rulesOf(page) {
  return [...(page.rules ?? []), ...page.items.flatMap(rangeStop)];
}

/** @param {string} questionKey */
export function rangeStopKey(questionKey) {
  return `${questionKey}-range`;
}

/** @param {number} index */
export function tallyPageNumber(index) {
  return index + 1;
}

/** The stop a number question that words its own out-of-range message makes.
 *  @param {Item} q @returns {Reject[]} */
function rangeStop(q) {
  if ((q.kind !== "money" && q.kind !== "number") || q.rangeMessage === undefined) {
    return [];
  }
  return [{
    kind: "reject",
    key: rangeStopKey(q.key),
    when: [{kind: "outside", question: q.key, range: q.range}],
    message: q.rangeMessage(q.range),
  }];
}
