/** The events a Tally embed posts that a page acts on. */
export declare const TALLY_EVENTS: {
  readonly PAGE_VIEW: "Tally.FormPageView";
  readonly SUBMITTED: "Tally.FormSubmitted";
};

/** The origin Tally serves forms from, and that an embed posts from. */
export declare const TALLY_ORIGIN: "https://tally.so";

/** Tally's widget script, which sizes an embedded form and loads it lazily. */
export declare const TALLY_WIDGET_URL: "https://tally.so/widgets/embed.js";

/** How a Casomo site embeds a form: aligned with the page, no second title,
 *  the page's own ground behind it, and as tall as the form. A house choice,
 *  kept here so every site embeds alike. */
export declare const TALLY_EMBED_OPTIONS:
  "alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";

/** A form's own public page on Tally. */
export declare function tallyFormHref(formId: string): string;

/** The address a form is embedded from: the embed options, then any hidden
 *  fields, each escaped. The fields come in any shape `URLSearchParams`
 *  takes: a record, pairs, or a query string a page already holds. */
export declare function tallyEmbedSrc(
  formId: string,
  hidden?: ConstructorParameters<typeof URLSearchParams>[0],
): string;

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
