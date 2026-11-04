/**
 * Reading the events a Tally embed posts to the page that hosts it.
 *
 * Tally sends each one as a JSON string, `{event, payload}`
 * (https://developers.tally.so/widgets/events, read 6 Oct 2026). A submit's
 * payload carries the respondent's answers, so this reads no more than the
 * event's name and, for a page view, the page number, and returns nothing
 * else: a caller can't pass the answers on because it never receives them.
 *
 * It runs in a browser, so it imports nothing; the rest of `./tally` reads
 * files and calls Tally's API, and stays out of a page's bundle.
 */

export const TALLY_EVENTS = Object.freeze({
  PAGE_VIEW: "Tally.FormPageView",
  SUBMITTED: "Tally.FormSubmitted",
});

/** The origin a Tally embed posts from; a message from any other is not
 *  Tally's. */
export const TALLY_ORIGIN = "https://tally.so";

/**
 * One message the page received, read down to the event it names, or
 * undefined for any message that is not one of this form's: one from another
 * origin, another form's, or one that doesn't parse. It takes the message
 * event whole, so the origin is checked here rather than left to each page.
 * @param {{origin: string, data: unknown}} received
 * @param {string} formId
 * @returns {{name: "Tally.FormPageView", page: number}
 *   | {name: "Tally.FormSubmitted"} | undefined}
 */
export function readTallyEvent({origin, data}, formId) {
  if (origin !== TALLY_ORIGIN) return undefined;
  const message = parseMessage(data);
  if (message?.payload.formId !== formId) return undefined;
  const {event, payload} = message;
  if (event === TALLY_EVENTS.SUBMITTED) return {name: TALLY_EVENTS.SUBMITTED};
  if (event === TALLY_EVENTS.PAGE_VIEW && typeof payload.page === "number") {
    return {name: TALLY_EVENTS.PAGE_VIEW, page: payload.page};
  }
  return undefined;
}

/**
 * A message's event name and payload, or undefined when it isn't a JSON
 * object with a payload object.
 * @param {unknown} data
 * @returns {{event: unknown, payload: Record<string, unknown>} | undefined}
 */
function parseMessage(data) {
  if (typeof data !== "string") return undefined;
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    // A string that isn't JSON isn't an event Tally sent; ignoring it is the
    // whole of the right response.
    return undefined;
  }
  if (typeof message !== "object" || message === null) return undefined;
  const {event, payload} = message;
  if (typeof payload !== "object" || payload === null) return undefined;
  return {event, payload};
}
