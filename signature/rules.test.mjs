#!/usr/bin/env node
// The signature rules and readers, on a made-up signature and PNG headers.
import {strict as assert} from "node:assert";
import * as rules from "./rules.mjs";

const {attribute, escapeRegExp, hrefs, imageTags, readPng} = rules;

const HTML = '<table><tr><td><a href="https://e.com/?a=1&amp;b=2">'
  + '<img src="https://e.com/sig/a.png" width="34" height="34" alt="A" border="0">'
  + "</a></td></tr></table>";

assert.deepEqual(imageTags(HTML),
  ['<img src="https://e.com/sig/a.png" width="34" height="34" alt="A" border="0">']);
assert.deepEqual(hrefs(HTML), ["https://e.com/?a=1&b=2"]);
assert.equal(attribute(imageTags(HTML)[0], "width"), "34");
assert.throws(() => attribute("<img src=x>", "alt"), /has no alt/);
assert.ok(new RegExp(escapeRegExp("a.b(c)")).test("xa.b(c)y"));
assert.ok(!new RegExp(escapeRegExp("a.b")).test("axb"));

/** A PNG's first 26 bytes: signature, then a header chunk of this size and
 *  colour type.  @param {number} width @param {number} height
 *  @param {number} colourType */
function png(width, height, colourType) {
  const bytes = Buffer.alloc(26);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[25] = colourType;
  return bytes;
}
assert.deepEqual(readPng(png(68, 34, rules.PNG_RGB)),
  {width: 68, height: 34, colourType: rules.PNG_RGB});
assert.throws(() => readPng(Buffer.from("GIF89a")), /not a PNG/);

// The hand-written declaration (index.d.mts) held to the code: an export it
// names and the code lacks fails the typecheck here.
/** @type {typeof import("./index.d.mts")} */
const declared = rules;
assert.equal(declared, rules);

console.log("signature tests OK");
