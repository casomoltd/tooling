/** The two ends of an out-of-range group. */
export declare const RANGE_ENDS: {
  readonly Below: "below";
  readonly Above: "above";
};

/** A uuid derived from a form key and a path within it, shaped as a version 4
 *  uuid because Tally rejects an option reference shaped any other way. */
export declare function stableUuid(formKey: string, path: string): string;

/** Every path the translator writes a block or group under, and the uuid each
 *  becomes. */
export declare class Paths {
  constructor(formKey: string);
  readonly formKey: string;
  block(path: string): string;
  group(path: string): string;
  answer(questionKey: string): string;
  inputOf(questionKey: string): string;
  option(questionKey: string, optionKey: string): string;
  formTitle(): string;
  pageBreakOf(pageKey: string): string;
  pageTitleOf(pageKey: string): string;
  thankYouBreak(): string;
  showOf(itemKey: string): string;
  logicOf(path: string): string;
  calcField(ratioKey: string): string;
  titleOf(questionKey: string): string;
  helpOf(questionKey: string): string;
  hiddenOf(key: string): string;
  mention(setting: string): string;
  hiddenField(itemKey: string, name: string): string;
  /** A question's help line. */
  helpText(questionKey: string): string;
  /** A stop's message. */
  messageOf(ruleKey: string): string;
  conditionOf(path: string, n: number): string;
  actionOf(path: string, n: number): string;
  eitherOf(path: string, n: number): string;
  rangeEnd(path: string, end: (typeof RANGE_ENDS)[keyof typeof RANGE_ENDS]): string;
  textOf(key: string): string;
  calcOf(ratioKey: string): string;
}
