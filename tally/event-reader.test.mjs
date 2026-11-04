#!/usr/bin/env node
// Tests for reading a Tally embed's messages: what a page learns from each,
// and that a submission's answers never reach it.
import {strict as assert} from "node:assert";
import {readTallyEvent, TALLY_EVENTS, TALLY_ORIGIN} from "./event-reader.mjs";

const FORM = "Ab3dE9";

/** A message from Tally's frame.
 * @param {string} event @param {Record<string, unknown>} payload */
const message = (event, payload) => ({
  origin: TALLY_ORIGIN, data: JSON.stringify({event, payload}),
});

/** @param {unknown} data */
const fromTally = (data) => ({origin: TALLY_ORIGIN, data});

// A page view, read down to its page number.
assert.deepEqual(
  readTallyEvent(message(TALLY_EVENTS.PAGE_VIEW, {formId: FORM, page: 3}), FORM),
  {name: TALLY_EVENTS.PAGE_VIEW, page: 3},
);

// A submission, read as its name alone, never its answers.
assert.deepEqual(
  readTallyEvent(message(TALLY_EVENTS.SUBMITTED, {
    formId: FORM,
    id: "sub1",
    fields: [{id: "f1", title: "Your name", value: "A Member"}],
  }), FORM),
  {name: TALLY_EVENTS.SUBMITTED},
);

// Another origin, another form, and anything that doesn't parse.
assert.equal(readTallyEvent({
  ...message(TALLY_EVENTS.SUBMITTED, {formId: FORM}),
  origin: "https://example.com",
}, FORM), undefined);
assert.equal(
  readTallyEvent(message(TALLY_EVENTS.SUBMITTED, {formId: "other"}), FORM),
  undefined,
);
assert.equal(
  readTallyEvent(fromTally({event: TALLY_EVENTS.SUBMITTED}), FORM), undefined,
);
assert.equal(
  readTallyEvent(fromTally("Tally.FormSubmitted, not JSON"), FORM), undefined,
);
assert.equal(readTallyEvent(fromTally("null"), FORM), undefined);
assert.equal(
  readTallyEvent(fromTally(JSON.stringify({event: TALLY_EVENTS.SUBMITTED})), FORM),
  undefined,
);

// A page view without a page number is not one.
assert.equal(
  readTallyEvent(message(TALLY_EVENTS.PAGE_VIEW, {formId: FORM}), FORM),
  undefined,
);

console.log("tally event-reader tests OK");
