#!/usr/bin/env node
// The shared Tally frame mounted in a simulated browser, where its effects
// run: a message from Tally's origin about this form reaches `onEvent`, any
// other message doesn't, the latest handler is the one called, and nothing
// is heard once the frame is gone.
import {strict as assert} from "node:assert";
import {JSDOM} from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.com/contact",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  MessageEvent: dom.window.MessageEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {act, createElement: h} = await import("react");
const {createRoot, hydrateRoot} = await import("react-dom/client");
const {renderToString} = await import("react-dom/server");
const {TallyFrame, useBrowserValue} = await import("./frame-component.mjs");
const {TALLY_EVENTS, TALLY_ORIGIN} = await import("./embed.mjs");

const FORM = "AbC123";

/** A message as Tally's embed posts one, from the given origin.
 *  @param {string} origin @param {string} [formId] @param {string} [event] */
function post(origin, formId = FORM, event = TALLY_EVENTS.SUBMITTED) {
  dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
    origin, data: JSON.stringify({event, payload: {formId}}),
  }));
}

const root = createRoot(document.body.appendChild(document.createElement("div")));
/** @type {string[]} */
const heard = [];
/** @param {string} who */
const render = (who) => act(() => root.render(h(TallyFrame, {
  formId: FORM, title: "Form", hidden: {},
  onEvent: (event) => heard.push(`${who}:${event.name}`),
})));

// Until the page knows the hidden fields there is no frame; once it does,
// the frame is drawn in its place.
await act(() => root.render(h(TallyFrame, {
  formId: FORM, title: "Form", hidden: undefined,
})));
assert.equal(document.querySelector("iframe"), null);
await render("first");
assert.ok(document.querySelector("iframe[data-tally-src]"), "the frame is drawn");

post(TALLY_ORIGIN);
assert.deepEqual(heard, [`first:${TALLY_EVENTS.SUBMITTED}`]);

// Another origin, or another form's message, is not this form's.
post("https://evil.example");
post(TALLY_ORIGIN, "OtherForm");
assert.equal(heard.length, 1);

// A new handler on the next render is the one called.
await render("second");
post(TALLY_ORIGIN);
assert.equal(heard.at(-1), `second:${TALLY_EVENTS.SUBMITTED}`);

// Once the frame is gone, nothing is heard.
await act(() => root.unmount());
post(TALLY_ORIGIN);
assert.equal(heard.length, 2);

// A browser value is unread on the server and in the first render as the
// page hydrates, and read once the page is in a browser.
/** @type {(string | undefined)[]} */
const seen = [];
function Reader() {
  seen.push(useBrowserValue(() => window.location.pathname));
  return null;
}
const host = document.body.appendChild(document.createElement("div"));
host.innerHTML = renderToString(h(Reader));
assert.deepEqual(seen, [undefined], "unread on the server");
seen.length = 0;
const hydrated = await act(() => hydrateRoot(host, h(Reader)));
assert.equal(seen[0], undefined, "unread as the page hydrates");
assert.equal(seen.at(-1), "/contact", "read once hydrated");
await act(() => hydrated.unmount());

console.log("tally frame DOM tests OK");
