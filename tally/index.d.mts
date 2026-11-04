/**
 * A Tally form kept as code: the model a site writes its forms in, and what
 * the engine gives back. The engine translates a form into the `blocks` and
 * `settings` Tally's API takes, pushes it, and compares it with what Tally
 * holds. A site keeps only its forms, their ids and their styling.
 */

/** The lowest and highest value a number question accepts. */
export interface Range {
  min: number;
  max: number;
}

/** A run of words with marks: a link, bold, italic, or more than one. */
export interface Styled {
  text: string;
  /** The page the words open when clicked. */
  href?: string;
  bold?: boolean;
  italic?: boolean;
}

/** Copy the respondent reads: plain words, or runs of words with marks. */
export type Text = string | (string | Styled)[];

/** One answer a choice question offers. The key is stable; the label is copy. */
export interface Option {
  key: string;
  label: string;
}

/**
 * Something true of the answers so far. A list of conditions holds when all
 * of them do; {@link Either} holds when any of its conditions does.
 */
export type Condition =
  | Outside
  | Answered
  | Chose
  | DateBefore
  | DateAfter
  | DateBeforeAnswer
  | Empty
  | Above
  | Below
  | Either;

/** A question has an answer. */
export interface Answered {
  kind: "answered";
  question: string;
}

/** A question or hidden field has no answer: for a hidden field, the
 *  embed's address carried no value for it. */
export interface Empty {
  kind: "empty";
  question: string;
}

/** A choice question was answered with one of these options, or a checkbox
 *  question had one of them ticked. */
export interface Chose {
  kind: "chose";
  question: string;
  options: string[];
}

/** A date question was answered with a date before this ISO date. */
export interface DateBefore {
  kind: "dateBefore";
  question: string;
  date: string;
}

/** A date question was answered with a date after this ISO date. */
export interface DateAfter {
  kind: "dateAfter";
  question: string;
  date: string;
}

/** A date question was answered with a date before another one's answer. */
export interface DateBeforeAnswer {
  kind: "dateBeforeAnswer";
  question: string;
  other: string;
}

/** A calculation came out above this value. */
export interface Above {
  kind: "above";
  calculation: string;
  value: number;
}

/** A calculation came out below this value. */
export interface Below {
  kind: "below";
  calculation: string;
  value: number;
}

/** A number question was answered with a figure outside this range. */
export interface Outside {
  kind: "outside";
  question: string;
  range: Range;
}

/** Any one of these conditions holds. */
export interface Either {
  kind: "either";
  conditions: Condition[];
}

interface QuestionBase {
  /** Stable for the life of the form: it fixes the question's uuids. */
  key: string;
  /** The question as the respondent reads it, and the Sheet's column name. */
  title: string;
  required: boolean;
  /** A line of help shown under the title. */
  help?: Text;
  /** Shown only when all of these hold. Hidden until then. */
  showWhen?: Condition[];
}

/** Short text, optionally capped at a number of characters. */
export type TextQuestion = QuestionBase & { kind: "text"; maxLength?: number };
/** An email address; with `verify`, the respondent must enter a code sent to
 *  it before going on, so answers cannot reach an address they mistyped (a
 *  Tally Business feature). */
export type EmailQuestion = QuestionBase & { kind: "email"; verify?: boolean };
/** A free-text answer. The placeholder shows an example answer, greyed out,
 *  until the respondent types. */
export type LongTextQuestion = QuestionBase & {
  kind: "longText";
  placeholder?: string;
};

/**
 * What a number question takes beyond its key and title: the range it
 * accepts, and optionally the words to stop on outside it and a grey figure
 * shown in the empty box.
 *
 * Without `rangeMessage`, Tally refuses a figure outside the range with its
 * own message. With it, the form says its own instead, as a stop message at
 * the foot of the page, where every rule's message goes, because Tally's
 * message can't be reworded.
 */
interface NumberBase {
  range: Range;
  /** Given the question's own range, so the words can't state another. */
  rangeMessage?: (range: Range) => Text;
  placeholder?: string;
}
/** An amount in the form's currency ({@link Locale}). */
export type MoneyQuestion = QuestionBase & NumberBase & { kind: "money" };
export type NumberQuestion = QuestionBase & NumberBase & { kind: "number" };

/** The earliest and latest dates a date question's picker offers, as ISO
 *  dates. */
export interface DateRange {
  from: string;
  to: string;
}

/** A date, in the form's date format, optionally within a range and with
 *  the future ruled out. */
export type DateQuestion = QuestionBase & {
  kind: "date";
  dateRange?: DateRange;
  /** Days the picker refuses. Absent, it refuses none. */
  disable?: DisabledDays;
};

/** Days a date question refuses: the ones after today. */
export type DisabledDays = keyof typeof DISABLED_DAYS;

/** One answer from a list. */
export type ChoiceQuestion = QuestionBase & { kind: "choice"; options: Option[] };
/** One answer from a list too long to lay out: a menu. */
export type DropdownQuestion = QuestionBase & {
  kind: "dropdown";
  options: Option[];
};
/** Any number of answers from a list; one box makes an acknowledgement. */
export type CheckboxQuestion = QuestionBase & {
  kind: "checkbox";
  options: Option[];
};

/** Every kind of question a form can ask. */
export type Question =
  | TextQuestion
  | EmailQuestion
  | LongTextQuestion
  | MoneyQuestion
  | NumberQuestion
  | DateQuestion
  | ChoiceQuestion
  | DropdownQuestion
  | CheckboxQuestion;

/** A question answered from a list of options. */
export type OptionsQuestion = ChoiceQuestion | DropdownQuestion | CheckboxQuestion;

/** Copy on a page that asks nothing: an introduction or an explanation. */
export interface Note {
  kind: "note";
  key: string;
  text: Text;
  showWhen?: Condition[];
}

/**
 * Answers the page that embeds the form passes in through the embed's
 * address, stored with the submission. One Tally block holds them all. A
 * condition or a ratio names one by its field name, as it names a question
 * by its key. Never shown, so never conditional.
 */
export interface HiddenFields {
  kind: "hiddenFields";
  key: string;
  fields: readonly string[];
  showWhen?: never;
}

export type Item = Question | Note | HiddenFields;

/** Leave this page for another when the conditions hold. */
export interface Jump {
  kind: "jump";
  key: string;
  when: Condition[];
  to: string;
}

/** Stop the respondent going further when the conditions hold: the message
 *  shows and the button that would carry them on is hidden. */
export interface Reject {
  kind: "reject";
  key: string;
  when: Condition[];
  message: Text;
}

/** A number worked out from two answers, as one divided by the other. */
export interface Ratio {
  kind: "ratio";
  key: string;
  name: string;
  numerator: string;
  denominator: string;
}

export type Rule = Jump | Reject | Ratio;

/** A page of the form: its heading, its items in order, and its rules. */
export interface Page {
  key: string;
  /** Shown as a heading at the top of the page. */
  title?: string;
  items: Item[];
  rules?: Rule[];
}

/**
 * How the form writes amounts and dates. Required, because a form that left
 * it out would take one country's currency and date order without saying so.
 */
export interface Locale {
  /** Tally's currency format, as its editor writes it: `"POUND"` for £. */
  currencyFormat: string;
  /** The symbol drawn before an amount, and in an empty amount's box. */
  currencySymbol: string;
  /** Tally's date format string, such as `"dd/MM/yyyy"`. */
  dateFormat: string;
}

export interface FormDefinition {
  /** Stable for the life of the form: it seeds every uuid. */
  key: string;
  title: string;
  /** The words on the button that moves the respondent on from a page. */
  pageButton: string;
  locale: Locale;
  pages: Page[];
  /** What the respondent sees after submitting, in place of Tally's own page. */
  thankYou?: Note[];
  /** The email Tally sends the respondent on Submit. Absent, a push turns
   *  Tally's off, so dropping it from the code stops the email. */
  confirmationEmail?: RespondentEmail;
  /** The email Tally sends the form's owner on Submit. Absent, a push leaves
   *  Tally's own setting as it is, so one set by hand in the editor stays. */
  notification?: SelfNotification;
  settings: FormSettings;
}

/** The form settings a push writes, as Tally's API names them. */
export interface FormSettings {
  /** Show how far through the form the respondent is. */
  hasProgressBar: boolean;
  /** Keep answers in the respondent's own browser so they can come back. */
  saveForLater: boolean;
  /** Keep unfinished answers on Tally's servers for the form's owner to see. */
  hasPartialSubmissions: boolean;
  /** Move to the next page as soon as a choice is answered, where Tally
   *  allows it, rather than waiting for Continue. */
  pageAutoJump: boolean;
  /** Draw A, B, C beside a choice question's answers. */
  badges: boolean;
  /** The theme and custom CSS; left as Tally has it when absent. */
  styles?: Styles;
}

/** A form's look as Tally stores it in the form's settings. */
export interface Styles {
  theme: "CUSTOM";
  color: {
    background: string;
    text: string;
    accent: string;
    buttonBackground: string;
    buttonText: string;
  };
  /** Tally loads a Google font named here; custom CSS can't load one. */
  font: { provider: "Google"; family: string };
  css: string;
}

/** The email Tally sends a respondent when they submit, in the form's own
 *  terms: the question it goes to by key, and its copy as {@link Text}. */
export interface RespondentEmail {
  /** The key of the email question whose answer it is sent to. */
  to: string;
  fromName: string;
  replyTo: string;
  subject: string;
  body: Text;
  /** Attach the respondent's answers as a PDF. */
  attachPdf: boolean;
}

/** The email Tally sends the form's owner when someone submits. */
export interface SelfNotification {
  /** Where it goes. */
  to: string;
  subject: string;
  /** The key of the email question whose answer a reply goes to, so the
   *  owner answers the respondent by replying. */
  replyTo: string;
}

/** A setting's text as Tally stores it: runs, and the answers they mention. */
export interface RichText {
  safeHTMLSchema: unknown[];
  mentions: Mention[];
}

/** A placeholder in a setting's text for one answer. */
export interface Mention {
  uuid: string;
  field: FieldRef;
  defaultValue: string;
}

/** What a condition, calculation or mention reads, as Tally names it. */
export type FieldRef = Record<string, string> & {
  type: (typeof FIELD_REF_TYPES)[keyof typeof FIELD_REF_TYPES];
};

/** Everything a push writes to a form's settings. */
export type TallySettings = Omit<FormSettings, "badges">
  & (RespondentEmailSettings | { hasRespondentEmailNotifications: false })
  & (SelfEmailSettings | Record<never, never>);

/** The confirmation email as Tally's settings name it. */
export interface RespondentEmailSettings {
  hasRespondentEmailNotifications: true;
  respondentEmailTo: RichText;
  respondentEmailFromName: RichText;
  respondentEmailReplyTo: RichText;
  respondentEmailSubject: RichText;
  respondentEmailBody: RichText;
  respondentEmailAttachPdf: boolean;
}

/** The owner's notification as Tally's settings name it. */
export interface SelfEmailSettings {
  hasSelfEmailNotifications: true;
  selfEmailTo: RichText;
  selfEmailReplyTo: RichText;
  selfEmailSubject: RichText;
}

export type BlockType = (typeof BLOCK_TYPES)[keyof typeof BLOCK_TYPES];
export type GroupType =
  | BlockType
  | (typeof GROUP_TYPES)[keyof typeof GROUP_TYPES];

/** One block as Tally's API takes and returns it. */
export interface Block {
  uuid: string;
  type: BlockType;
  groupUuid: string;
  groupType: GroupType;
  payload: Record<string, unknown>;
}

export declare const BLOCK_TYPES: {
  readonly FormTitle: "FORM_TITLE";
  readonly Title: "TITLE";
  readonly Heading2: "HEADING_2";
  readonly Text: "TEXT";
  readonly PageBreak: "PAGE_BREAK";
  readonly InputText: "INPUT_TEXT";
  readonly InputEmail: "INPUT_EMAIL";
  readonly Textarea: "TEXTAREA";
  readonly InputNumber: "INPUT_NUMBER";
  readonly InputDate: "INPUT_DATE";
  readonly ChoiceOption: "MULTIPLE_CHOICE_OPTION";
  readonly DropdownOption: "DROPDOWN_OPTION";
  readonly Checkbox: "CHECKBOX";
  readonly Logic: "CONDITIONAL_LOGIC";
  readonly CalculatedFields: "CALCULATED_FIELDS";
  readonly HiddenFields: "HIDDEN_FIELDS";
};

export declare const GROUP_TYPES: {
  readonly Question: "QUESTION";
  readonly MultipleChoice: "MULTIPLE_CHOICE";
  readonly Dropdown: "DROPDOWN";
  readonly Checkboxes: "CHECKBOXES";
};

export declare const COMPARISONS: {
  readonly Is: "IS";
  readonly IsAnyOf: "IS_ANY_OF";
  readonly IsNotEmpty: "IS_NOT_EMPTY";
  readonly IsEmpty: "IS_EMPTY";
  readonly IsBefore: "IS_BEFORE";
  readonly IsAfter: "IS_AFTER";
  readonly GreaterThan: "GREATER_THAN";
  readonly LessThan: "LESS_THAN";
};

export declare const ACTION_TYPES: {
  readonly ShowBlocks: "SHOW_BLOCKS";
  readonly JumpToPage: "JUMP_TO_PAGE";
  readonly HideButton: "HIDE_BUTTON_TO_DISABLE_COMPLETION";
  readonly Calculate: "CALCULATE";
};

/** What a condition or calculation reads: a question's answer, a hidden
 *  field's value, or a calculation's result. */
export declare const FIELD_REF_TYPES: {
  readonly Input: "INPUT_FIELD";
  readonly Hidden: "HIDDEN_FIELD";
  readonly Calculated: "CALCULATED_FIELD";
};

/** A date question's disabled days, as Tally's `disableDays` names them.
 *  Only the one a pushed form has carried is listed; add another once Tally
 *  has been seen to accept it. */
export declare const DISABLED_DAYS: {
  readonly future: "IN_THE_FUTURE";
};

/** A logic block's conditionals: one comparison or a group, joined by AND
 *  or OR. */
export declare const CONDITIONALS: {
  readonly Single: "SINGLE";
  readonly Group: "GROUP";
  readonly And: "AND";
  readonly Or: "OR";
};

/** A calculated field's type and the operators a ratio is worked out with. */
export declare const CALCULATION: {
  readonly Number: "NUMBER";
  readonly Assign: "ASSIGNMENT";
  readonly Divide: "DIVISION";
};

export type Comparison = (typeof COMPARISONS)[keyof typeof COMPARISONS];
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

/**
 * Translate a form into Tally's blocks, in reading order. Throws when two
 * things share a key, or a condition or rule names a question, option,
 * calculation or page the form does not hold, because Tally would accept the
 * logic and then never fire it.
 */
export declare function toBlocks(form: FormDefinition): Block[];

/** A name for each block `toBlocks` writes, by uuid, so a difference reads
 *  as "consent title" rather than a uuid. */
export declare function blockNames(form: FormDefinition): (uuid: string) => string;

/** A form's settings as a push writes them. Throws when an email names a
 *  key that is not an email question, because Tally would accept the
 *  setting and send nothing. */
export declare function toSettings(form: FormDefinition): TallySettings;

/** What a push of the form sends, in the shape the `tally` command records
 *  after a push: for a site that pins its forms' output, so the pin covers
 *  exactly what is sent. */
export declare function pushedVersion(
  form: FormDefinition,
): {blocks: Block[]; settings: TallySettings};

/** A page's rules: its own, then a stop for each number question that words
 *  its own out-of-range message. */
export declare function rulesOf(page: Page): Rule[];

/** The key of the stop a number question's own range message makes. */
export declare function rangeStopKey(questionKey: string): string;

/** Tally numbers pages from 1; a form's pages are held from 0. */
export declare function tallyPageNumber(index: number): number;

/**
 * The uuids of a form's blocks, by what they are, for a site's styling that
 * targets them. Built once per form; every method throws when the form has
 * no such question or option, so styling cannot name a block that is not
 * there.
 */
export declare class FormIndex {
  constructor(form: Pick<FormDefinition, "key" | "pages">);
  /** A question's title block. */
  title(questionKey: string): string;
  /** A single-input question's input block. */
  input(questionKey: string): string;
  /** One option's block. */
  option(questionKey: string, optionKey: string): string;
  /** Every option of an options question, in its order. */
  options(questionKey: string): string[];
  /** Every block a question shows where it stands: title, help, input or
   *  options (and an options question's answer group). */
  questionBlocks(questionKey: string): string[];
  /** Each stop message's block, in the form's order. */
  stopMessages(): string[];
}

/** One selector per block, by Tally's documented `.tally-block-<uuid>`
 *  class, each with the same suffix. */
export declare function blockSelectors(uuids: string[], suffix: string): string;

/** One custom property's value from a stylesheet's top-level `:root` or
 *  `@theme` block. Throws when it is absent. */
export declare function readToken(css: string, name: string): string;

// "./paths.mjs" names no file: TypeScript reads it as paths.d.mts, the
// declaration of address.mjs, where the code is.
export { Paths, stableUuid } from "./paths.mjs";
