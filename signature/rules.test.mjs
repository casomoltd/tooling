#!/usr/bin/env node
// The signature rules and readers, on a made-up signature and PNG headers.
import {strict as assert} from "node:assert";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import * as faults from "./faults.mjs";
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

// The suite, on that signature with its one image in a folder of its own,
// then with each rule broken in turn, so every check is seen to fire.
const {cacheFault, signatureFaults} = faults;
const dir = mkdtempSync(join(tmpdir(), "signature-test-"));
try {
  writeFileSync(join(dir, "a.png"), png(68, 68, rules.PNG_RGB));
  /** @type {import("../identity/index.d.mts").Registration} */
  const register = {url: "https://r.example/1", number: "1"};
  const colophonHtml =
    "<p>Office line. Registered <a href=\"https://r.example/1\">1</a></p>";
  /** @type {import("./index.d.mts").SignatureFacts} */
  const facts = {
    html: `${HTML}${colophonHtml}`,
    origin: "https://e.com",
    imagesPath: "/sig",
    imagesDir: dir,
    colophon: [{text: "Registered", register}, {text: "Office line", source: "https://o.example"}],
    linkSources: false,
  };
  /** @param {string} img */
  const withImage = (img) => ({...facts, html: `${img}${colophonHtml}`});
  const img = '<img src="https://e.com/sig/a.png" width="34" height="34" alt="A" border="0">';

  assert.deepEqual(signatureFaults(facts), []);
  assert.deepEqual(signatureFaults({...facts, linkSources: true}),
    ['lacks the colophon line "Office line"']);
  assert.deepEqual(signatureFaults({...facts, html: HTML}), [
    'lacks the colophon line "Registered"', 'lacks the colophon line "Office line"',
  ]);
  const overLimit = `${facts.html}${" ".repeat(rules.GMAIL_LIMIT)}`;
  assert.match(signatureFaults({...facts, html: overLimit})[0], /over Gmail's/);
  assert.deepEqual(signatureFaults(withImage(img.replace("e.com", "x.com"))), [
    "https://x.com/sig/a.png is not served from https://e.com/sig",
    "a.png is in the folder but unused",
  ]);
  assert.deepEqual(signatureFaults(withImage(img.replace('width="34"', 'width="30"'))),
    ["a.png is 68×68, not 60×68"]);
  assert.deepEqual(signatureFaults(withImage(img.replace('alt="A"', 'alt=" "'))),
    ["a.png has no alt text"]);
  assert.deepEqual(signatureFaults(withImage(img.replace('border="0"', 'border="1"'))),
    ['a.png lacks border="0"']);
  // A tag that can't be read is one named fault, not the end of the run.
  const noAlt = img.replace(' alt="A"', "");
  assert.deepEqual(signatureFaults(withImage(`${noAlt}<svg>`)), [
    "uses <svg, which a client drops",
    `${noAlt} can't be checked: ${noAlt} has no alt`,
  ]);
  const missing = img.replace("a.png", "gone.png");
  assert.match(signatureFaults(withImage(missing)).join("\n"),
    /gone\.png.* can't be checked: ENOENT/);
  writeFileSync(join(dir, "a.png"), png(68, 68, 6));
  assert.deepEqual(signatureFaults(facts), ["a.png is not flattened to RGB"]);
  writeFileSync(join(dir, "a.png"), png(68, 68, rules.PNG_RGB));
  writeFileSync(join(dir, "b.png"), png(68, 68, rules.PNG_RGB));
  assert.deepEqual(signatureFaults({...facts, html: `${facts.html}<svg>`}),
    ["uses <svg, which a client drops", "b.png is in the folder but unused"]);
} finally {
  rmSync(dir, {recursive: true, force: true});
}
/** @param {string} value */
const cache = (value) => [{key: "Cache-Control", value}];
assert.equal(cacheFault(cache("public, max-age=2592000")), undefined);
assert.match(cacheFault(cache("public, max-age=60")) ?? "", /under a day/);
assert.match(cacheFault(cache("max-age=2592000, immutable")) ?? "", /immutable/);
assert.match(cacheFault([{key: "X-Other", value: "1"}]) ?? "", /no Cache-Control/);
assert.match(cacheFault(undefined) ?? "", /no header rule/);

// The hand-written declaration (index.d.mts) held to the code: an export it
// names and the code lacks fails the typecheck here.
/** @type {typeof import("./index.d.mts")} */
const declared = {...rules, ...faults};
assert.equal(declared.cacheFault, cacheFault);

console.log("signature tests OK");
