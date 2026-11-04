#!/usr/bin/env node
// The shared Tally frame, rendered on the server as a page first draws it:
// the frame at its address and starting height, and the fallback for a
// reader without scripts.
import {strict as assert} from "node:assert";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import * as frame from "./frame-component.mjs";
import {TALLY_EMBED_OPTIONS} from "./embed.mjs";

const {TallyFrame, TALLY_FRAME_HEIGHT} = frame;

const html = renderToStaticMarkup(h(TallyFrame, {
  formId: "AbC123", title: "Contact form", hidden: "utm_source=blog",
}));
assert.match(html, new RegExp(
  `<iframe data-tally-src="https://tally.so/embed/AbC123\\?${TALLY_EMBED_OPTIONS
    .replaceAll("&", "&amp;")}&amp;utm_source=blog"`));
assert.match(html, new RegExp(`height="${TALLY_FRAME_HEIGHT}"`));
assert.match(html, /title="Contact form"/);
assert.match(html, /<noscript><p>The form can’t load here\. <a href="https:\/\/tally\.so\/r\/AbC123">Open it on Tally<\/a>\.<\/p><\/noscript>/);

// A site draws the fallback in its own style.
const styled = renderToStaticMarkup(h(TallyFrame, {
  formId: "AbC123", title: "Form", hidden: {},
  fallback: (href) => h("a", {href}, "Here"),
}));
assert.match(styled, /<noscript><a href="https:\/\/tally\.so\/r\/AbC123">Here<\/a><\/noscript>/);

// Until the page knows the hidden fields, the frame holds its space and
// renders only the form's own page for a reader without scripts.
const pending = renderToStaticMarkup(h(TallyFrame, {
  formId: "AbC123", title: "Form", hidden: undefined,
}));
assert.match(pending,
  new RegExp(`^<div style="min-height:${TALLY_FRAME_HEIGHT}px"><noscript>`));
assert.doesNotMatch(pending, /<iframe/);

// The hand-written declaration (frame.d.mts) held to the code: an export
// the declaration names and the code lacks fails the typecheck here, and the
// code takes its props type from the declaration, so the props are spelled
// once.
/** @type {typeof import("./frame.d.mts")} */
const declared = frame;
assert.equal(declared, frame);

console.log("tally frame tests OK");
