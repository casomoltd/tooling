#!/usr/bin/env node
// Tests for the shared markup helpers.
import {strict as assert} from "node:assert";
import {decodeEntities, escapeRegExp, startTags} from "./html.mjs";

assert.equal(decodeEntities("a&amp;b &quot;c&quot; &lt;d&gt; it&apos;s"),
  "a&b \"c\" <d> it's");
assert.equal(decodeEntities("&AMP;&LT;&GT;&QUOT;"), "&<>\"");
assert.equal(decodeEntities("&#65;&#x27;&#X41;"), "A'A");
assert.equal(decodeEntities("&#0;&#xD800;&#x110000;"), "\uFFFD".repeat(3));
// The typographic names, each to its character; lower case only.
assert.equal(decodeEntities("&nbsp;&lsquo;&rsquo;&ldquo;&rdquo;&ndash;&mdash;&hellip;"),
  "\u00A0\u2018\u2019\u201C\u201D\u2013\u2014\u2026");
assert.equal(decodeEntities("&Rsquo;&NBSP;"), "&Rsquo;&NBSP;");
// A name HTML doesn't accept in that case, or doesn't know, is left alone.
assert.equal(decodeEntities("&APOS;&Amp;&frac12;&amp"), "&APOS;&Amp;&frac12;&amp");
// One pass: an escaped reference reads as the reference, not its character.
assert.equal(decodeEntities("&amp;lt;"), "&lt;");
// No Windows-1252 remapping, as the doc says.
assert.equal(decodeEntities("&#128;"), "\u0080");
assert.ok(new RegExp(escapeRegExp("a.b(c)")).test("xa.b(c)y"));
assert.ok(!new RegExp(escapeRegExp("a.b")).test("axb"));

/** @param {string} html */
const ids = (html) => startTags(html).flatMap(({attributes}) =>
  attributes.filter((a) => a.name === "id").map((a) => a.value));
assert.deepEqual(startTags("<p><IMG Alt=\"a &amp; b\" hidden src=x>"),
  [{name: "p", attributes: [], start: 0, end: 3}, {name: "img", attributes: [
    {name: "alt", value: "a & b"}, {name: "hidden"}, {name: "src", value: "x"},
  ], start: 3, end: 37}]);
// Only the first of a repeated attribute counts, as in a browser.
assert.deepEqual(ids("<a id=x id=y>"), ["x"]);
// A tag inside a quoted value is not one; an unclosed tag gives way to the
// next.
assert.deepEqual(ids("<img alt=\"<b id=z>\"><a foo <b id=x>"), ["x"]);

// One forward pass, so a page of tags left open is read in linear time. The
// bound is generous: a quadratic scan of these takes over a minute.
const BOUND_MS = 1000;
const PAGE_BYTES = 200_000;
for (const unit of ["<a x ", "<a"]) {
  const html = unit.repeat(PAGE_BYTES / unit.length);
  const started = performance.now();
  startTags(html);
  const took = performance.now() - started;
  assert.ok(took < BOUND_MS, `${JSON.stringify(unit)} x ${html.length}: ${took} ms`);
}
console.log("html tests OK");
