/**
 * Tally's own names for what this engine writes, as its API takes them and
 * its editor writes them. Each is typed by its declaration in index.d.mts, so
 * the two can't drift apart without failing the typecheck.
 */

/** @import * as Types from "./index.d.mts" */

/** @type {typeof Types.BLOCK_TYPES} */
export const BLOCK_TYPES = Object.freeze({
  FormTitle: "FORM_TITLE",
  Title: "TITLE",
  Heading2: "HEADING_2",
  Text: "TEXT",
  PageBreak: "PAGE_BREAK",
  InputText: "INPUT_TEXT",
  InputEmail: "INPUT_EMAIL",
  Textarea: "TEXTAREA",
  InputNumber: "INPUT_NUMBER",
  InputDate: "INPUT_DATE",
  ChoiceOption: "MULTIPLE_CHOICE_OPTION",
  DropdownOption: "DROPDOWN_OPTION",
  Checkbox: "CHECKBOX",
  Logic: "CONDITIONAL_LOGIC",
  CalculatedFields: "CALCULATED_FIELDS",
  HiddenFields: "HIDDEN_FIELDS",
});

/** @type {typeof Types.GROUP_TYPES} */
export const GROUP_TYPES = Object.freeze({
  Question: "QUESTION",
  MultipleChoice: "MULTIPLE_CHOICE",
  Dropdown: "DROPDOWN",
  Checkboxes: "CHECKBOXES",
});

/** @type {typeof Types.COMPARISONS} */
export const COMPARISONS = Object.freeze({
  Is: "IS",
  IsAnyOf: "IS_ANY_OF",
  IsNotEmpty: "IS_NOT_EMPTY",
  IsEmpty: "IS_EMPTY",
  IsBefore: "IS_BEFORE",
  IsAfter: "IS_AFTER",
  GreaterThan: "GREATER_THAN",
  LessThan: "LESS_THAN",
});

/** @type {typeof Types.ACTION_TYPES} */
export const ACTION_TYPES = Object.freeze({
  ShowBlocks: "SHOW_BLOCKS",
  JumpToPage: "JUMP_TO_PAGE",
  HideButton: "HIDE_BUTTON_TO_DISABLE_COMPLETION",
  Calculate: "CALCULATE",
});

/** @type {typeof Types.FIELD_REF_TYPES} */
export const FIELD_REF_TYPES = Object.freeze({
  Input: "INPUT_FIELD",
  Hidden: "HIDDEN_FIELD",
  Calculated: "CALCULATED_FIELD",
});

/** @type {typeof Types.DISABLED_DAYS} */
export const DISABLED_DAYS = Object.freeze({
  future: "IN_THE_FUTURE",
});

/** @type {typeof Types.CONDITIONALS} */
export const CONDITIONALS = Object.freeze({
  Single: "SINGLE",
  Group: "GROUP",
  And: "AND",
  Or: "OR",
});

/** @type {typeof Types.CALCULATION} */
export const CALCULATION = Object.freeze({
  Number: "NUMBER",
  Assign: "ASSIGNMENT",
  Divide: "DIVISION",
});

/** The badge type that draws no A/B/C beside a choice's answers. */
export const NO_BADGE = "OFF";

/**
 * The group type Tally names an answer by, for each kind of question. A
 * single-input question's block type is its group type too.
 * @type {Readonly<Record<Types.Question["kind"], Types.GroupType>>}
 */
export const QUESTION_TYPES = Object.freeze({
  text: BLOCK_TYPES.InputText,
  email: BLOCK_TYPES.InputEmail,
  longText: BLOCK_TYPES.Textarea,
  money: BLOCK_TYPES.InputNumber,
  number: BLOCK_TYPES.InputNumber,
  date: BLOCK_TYPES.InputDate,
  choice: GROUP_TYPES.MultipleChoice,
  dropdown: GROUP_TYPES.Dropdown,
  checkbox: GROUP_TYPES.Checkboxes,
});

/** The block types an option of a choice, dropdown or checkbox question
 *  is written as: each holds its share of the question's answers.
 *  @type {ReadonlySet<string>} */
export const OPTION_TYPES = Object.freeze(new Set([
  BLOCK_TYPES.ChoiceOption, BLOCK_TYPES.DropdownOption, BLOCK_TYPES.Checkbox,
]));
