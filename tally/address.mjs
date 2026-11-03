/**
 * The address of every block and group a generated form holds, as the uuids
 * Tally stores. Kept apart from the translator, and exported on its own as
 * `@casomoltd/tooling/tally/paths`, so a site's own code (a webhook reading a
 * submission) can name a pushed block without loading the form builder.
 */
import {createHash} from "node:crypto";

/** The hex digits in each of a uuid's five groups, by RFC 4122's names
 *  (https://www.rfc-editor.org/rfc/rfc4122#section-4.1.2). */
const TIME_LOW = 8;
const TIME_MID = 4;
const TIME_HI_AND_VERSION = 4;
const CLOCK_SEQ = 4;
const NODE = 12;
const GROUP_LENGTHS = [TIME_LOW, TIME_MID, TIME_HI_AND_VERSION, CLOCK_SEQ, NODE];

/** The two ends of an out-of-range group. */
export const RANGE_ENDS = Object.freeze(/** @type {const} */ ({
  Below: "below",
  Above: "above",
}));

/** The digit that opens the third group of a version 4 uuid. */
const VERSION_DIGIT = "4";

/** The fourth group opens with the RFC 4122 variant: binary 10xx, so the
 *  digit's top two bits are forced to 10 and its low two are kept. */
const VARIANT_KEEP = 0b0011;
const VARIANT_SET = 0b1000;
const HEX = 16;

/**
 * Every path the translator writes a block or group under, and the uuid each
 * becomes: the one place a block's address is spelt, so the push, the names
 * `tally diff` prints and a site's webhook can't disagree.
 */
export class Paths {
  /** @param {string} formKey */
  constructor(formKey) {
    /** @readonly */
    this.formKey = formKey;
  }

  /** The block itself. @param {string} path */
  block(path) {
    return stableUuid(this.formKey, path);
  }

  /** The group the block sits in. @param {string} path */
  group(path) {
    return stableUuid(this.formKey, `${path}/group`);
  }

  /** A question's answer group: what conditions read and Sheets store.
   *  @param {string} questionKey */
  answer(questionKey) {
    return stableUuid(this.formKey, `${questionKey}/input`);
  }

  /** The path of a single-input question's input block.
   *  @param {string} questionKey */
  inputOf(questionKey) {
    return `${questionKey}/input/block`;
  }

  /** @param {string} questionKey @param {string} optionKey */
  option(questionKey, optionKey) {
    return stableUuid(this.formKey, `${questionKey}/option/${optionKey}`);
  }

  formTitle() {
    return "form-title";
  }

  /** @param {string} pageKey */
  pageBreakOf(pageKey) {
    return `page/${pageKey}`;
  }

  /** @param {string} pageKey */
  pageTitleOf(pageKey) {
    return `page/${pageKey}/title`;
  }

  thankYouBreak() {
    return "page/thank-you";
  }

  /** The logic that shows a hidden item. @param {string} itemKey */
  showOf(itemKey) {
    return `${itemKey}/show`;
  }

  /** A logic block, for a rule's key or an item's `showOf`.
   *  @param {string} path */
  logicOf(path) {
    return `${path}/logic`;
  }

  /** @param {string} ratioKey */
  calcField(ratioKey) {
    return stableUuid(this.formKey, `${ratioKey}/calc/field`);
  }

  /** @param {string} questionKey */
  titleOf(questionKey) {
    return `${questionKey}/title`;
  }

  /** @param {string} questionKey */
  helpOf(questionKey) {
    return `${questionKey}/help`;
  }

  /** @param {string} key */
  hiddenOf(key) {
    return `${key}/hidden`;
  }

  /** A mention in one of the form's settings, by the setting's name.
   *  @param {string} setting */
  mention(setting) {
    return stableUuid(this.formKey, `settings/${setting}/mention`);
  }

  /** @param {string} itemKey @param {string} name */
  hiddenField(itemKey, name) {
    return stableUuid(this.formKey, `${itemKey}/hidden/${name}`);
  }

  /** A question's help line. @param {string} questionKey */
  helpText(questionKey) {
    return this.textOf(this.helpOf(questionKey));
  }

  /** A stop's message. @param {string} ruleKey */
  messageOf(ruleKey) {
    return this.textOf(ruleKey);
  }

  /** The nth condition of a logic block. @param {string} path @param {number} n */
  conditionOf(path, n) {
    return `${path}/if/${n}`;
  }

  /** The nth action of a logic block. @param {string} path @param {number} n */
  actionOf(path, n) {
    return `${path}/then/${n}`;
  }

  /** The nth condition of an "either" group. @param {string} path @param {number} n */
  eitherOf(path, n) {
    return `${path}/either/${n}`;
  }

  /** The low or high end of an out-of-range group.
   *  @param {string} path
   *  @param {(typeof RANGE_ENDS)[keyof typeof RANGE_ENDS]} end */
  rangeEnd(path, end) {
    return `${path}/${end}`;
  }

  /** @param {string} key */
  textOf(key) {
    return `${key}/text`;
  }

  /** @param {string} ratioKey */
  calcOf(ratioKey) {
    return `${ratioKey}/calc`;
  }
}

/**
 * A uuid derived from a form key and a path within it. It is shaped as a
 * version 4 uuid, though nothing in it is random, because Tally rejects an
 * option reference shaped any other way.
 * @param {string} formKey
 * @param {string} path
 * @returns {string}
 */
export function stableUuid(formKey, path) {
  const hex = createHash("sha256").update(`${formKey}\u0000${path}`).digest("hex");
  /** @type {string[]} */
  const groups = [];
  let at = 0;
  for (const length of GROUP_LENGTHS) {
    groups.push(hex.slice(at, at + length));
    at += length;
  }
  const [timeLow, timeMid, timeHiAndVersion, clockSeq, node] = groups;
  const variant =
    ((parseInt(clockSeq[0], HEX) & VARIANT_KEEP) | VARIANT_SET).toString(HEX);
  return [
    timeLow,
    timeMid,
    `${VERSION_DIGIT}${timeHiAndVersion.slice(1)}`,
    `${variant}${clockSeq.slice(1)}`,
    node,
  ].join("-");
}
