/** The events a Tally embed posts that a page acts on. */
export declare const TALLY_EVENTS: {
  readonly PAGE_VIEW: "Tally.FormPageView";
  readonly SUBMITTED: "Tally.FormSubmitted";
};

/** The origin a Tally embed posts from. */
export declare const TALLY_ORIGIN: "https://tally.so";

/** An event read down to what a page may act on: a page view's number, or
 *  that the form was submitted. Never the answers. */
export type TallyEvent =
  | {name: typeof TALLY_EVENTS.PAGE_VIEW; page: number}
  | {name: typeof TALLY_EVENTS.SUBMITTED};

/** One message the page received (a `MessageEvent` will do), read down to a
 *  {@link TallyEvent}, or undefined for any message that is not one of this
 *  form's, from Tally's origin. */
export declare function readTallyEvent(
  received: {origin: string; data: unknown},
  formId: string,
): TallyEvent | undefined;
