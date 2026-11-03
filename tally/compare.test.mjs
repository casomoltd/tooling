#!/usr/bin/env node
// Tests for comparing versions of a form: what tally diff reports and what a
// push refuses on. A comparison that missed an editor edit would let a push
// delete it, so each direction and each kind of difference is checked.
import {strict as assert} from "node:assert";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  baseline, codeVersion, droppedAnswers, formChanges, liveVersion, pushedStore,
  pushedVersion, pushRefusal, unportedEdits,
} from "./compare.mjs";
import {fixtureForm} from "./fixture.mjs";
import {toBlocks, toSettings} from "./translator.mjs";

/** @import {FormVersion} from "./compare.mjs" */

/** @param {string} uuid */
const name = (uuid) => uuid;

/** @param {string} uuid @param {Record<string, unknown>} payload */
const block = (uuid, payload) => ({
  uuid, type: "TEXT", groupUuid: `${uuid}-group`, groupType: "TEXT", payload,
});

/** @param {ReturnType<typeof block>[]} blocks @param {Record<string, unknown>} settings
 *  @returns {FormVersion} */
const version = (blocks, settings = {}) => ({blocks, settings});

/** @param {string[]} values */
const ordered = (values) => [...values].sort((x, y) => x.localeCompare(y));

const a = version([block("intro", {text: "Hello"}), block("gone", {text: "x"})],
  {hasProgressBar: true});
const b = version([block("intro", {text: "Hi"}), block("new", {text: "y"})],
  {hasProgressBar: true, saveForLater: false});

// The same changes are found in either direction, read the way they're given.
const forward = ordered(formChanges(a, b, name).map((c) => c.where));
assert.deepEqual(forward, ordered(formChanges(b, a, name).map((c) => c.where)));
assert.deepEqual(forward, ["gone", "intro", "new", "saveForLater"]);
const lines = formChanges(a, b, name).map((c) => c.line);
assert.ok(lines.includes("removed: gone (TEXT)"));
assert.ok(lines.includes('changed: intro text: "Hello" → "Hi"'));
assert.ok(formChanges(b, a, name).map((c) => c.line)
  .includes('changed: intro text: "Hi" → "Hello"'));
assert.deepEqual(formChanges(a, a, name), []);

// A long value is cut to fit a line.
const long = version([block("intro", {text: "x".repeat(400)})]);
const cut = formChanges(a, long, name).find((c) => c.where === "intro")?.line ?? "";
const shown = cut.slice(cut.indexOf("→ ") + "→ ".length);
assert.equal(shown.length, 160);
assert.ok(shown.endsWith("..."));

// The live form keeps only the fields and settings the code writes, and a
// block added in the editor whole.
const code = version([block("intro", {text: "Hello"})], {hasProgressBar: true});
const live = {
  id: "f", name: null, status: "PUBLISHED",
  settings: {hasProgressBar: true, language: "en"},
  blocks: [
    block("intro", {text: "Hello", tallyOwn: 1}),
    block("extra", {text: "Mine"}),
  ],
};
const cutDown = liveVersion(live, code);
const known = {...cutDown, blocks: cutDown.blocks.slice(0, 1)};
assert.deepEqual(formChanges(code, known, name), []);
assert.deepEqual(cutDown.blocks[1]?.payload, {text: "Mine"});
assert.deepEqual(liveVersion({...live, settings: null}, code).settings, {});

// An editor edit stops counting once the code holds it.
const pushed = version([block("intro", {text: "Hello"})]);
const edited = version([block("intro", {text: "Edited"})]);
assert.deepEqual(
  unportedEdits(pushed, pushed, edited, name).map((c) => c.where), ["intro"]);
assert.deepEqual(unportedEdits(pushed, edited, edited, name), []);

// The settings a version records are a plain copy.
assert.deepEqual(codeVersion([], {hasProgressBar: true, saveForLater: false,
  hasPartialSubmissions: false, pageAutoJump: false,
  hasRespondentEmailNotifications: false}).settings.hasProgressBar, true);

// A site's pin of a form is the version the command builds for its push.
assert.deepEqual(pushedVersion(fixtureForm),
  codeVersion(toBlocks(fixtureForm), toSettings(fixtureForm)));

// The store of last pushes: nothing until a push writes one, then that, and
// the baseline stands in with the code until there is a record.
const dir = await mkdtemp(path.join(os.tmpdir(), "tally-pushed-"));
try {
  const store = pushedStore(path.join(dir, "pushed"));
  assert.equal(await store.read("form"), undefined);
  assert.deepEqual(await baseline(store, "form", code),
    {version: code, recorded: false});
  await store.write("form", pushed);
  assert.deepEqual(await store.read("form"), pushed);
  assert.deepEqual(await baseline(store, "form", code),
    {version: pushed, recorded: true});
} finally {
  await rm(dir, {recursive: true, force: true});
}

// The answer guard: a push is refused when it would drop anything a
// submission's answers are held under. Each kind is dropped in turn.
const full = toBlocks(fixtureForm);
const liveForm = {
  id: "f", name: null, status: "PUBLISHED", settings: null, blocks: full,
};
assert.deepEqual(droppedAnswers(liveForm, full), []);
/** @param {(b: (typeof full)[number]) => boolean} drop */
const without = (drop) => droppedAnswers(liveForm, full.filter((b) => !drop(b)));
assert.match(without((b) => b.type === "TITLE" && JSON.stringify(b.payload).includes(
  "Your name")).join("\n"), /question \[\["Your name"\]\]/);
assert.match(without((b) => b.payload.text === "No").join("\n"), /option "No"/);
assert.match(without((b) => b.type === "CALCULATED_FIELDS").join("\n"),
  /calculation Salary per/);
const oneFieldLess = full.map((b) => b.type === "HIDDEN_FIELDS"
  ? {...b, payload: {hiddenFields: /** @type {{uuid: string, name: string}[]} */ (
    b.payload.hiddenFields)
    .filter((f) => f.name !== "divisor")}}
  : b);
assert.match(droppedAnswers(liveForm, oneFieldLess).join("\n"), /hidden field divisor/);
// Removing a note or a logic block drops no answers.
assert.deepEqual(
  without((b) => b.type === "TEXT" || b.type === "CONDITIONAL_LOGIC"), []);

// Each override lets through only its own refusal, and a push with no record
// of the last one says so rather than blame the editor.
const FLAGS = {deleteAnswers: "--delete-answers", discardEdits: "--discard-edits"};
const none = {deleteAnswers: false, discardEdits: false};
const lost = {dropped: ["  question x (u)"], edits: 0, recorded: true};
const editsOnly = {dropped: [], edits: 2, recorded: true};
assert.match(pushRefusal(lost, none, FLAGS) ?? "", /delete answers/);
assert.match(pushRefusal(lost, {...none, discardEdits: true}, FLAGS) ?? "",
  /delete answers/);
assert.equal(pushRefusal(lost, {...none, deleteAnswers: true}, FLAGS), undefined);
assert.match(pushRefusal(editsOnly, none, FLAGS) ?? "", /2 edits made in Tally/);
assert.match(pushRefusal(editsOnly, {...none, deleteAnswers: true}, FLAGS) ?? "",
  /2 edits made in Tally/);
assert.equal(pushRefusal(editsOnly, {...none, discardEdits: true}, FLAGS), undefined);
// Both at once: letting answers go still leaves the edits refusal standing.
assert.match(pushRefusal({...lost, edits: 2}, {...none, deleteAnswers: true}, FLAGS)
  ?? "", /2 edits made in Tally/);
assert.match(pushRefusal({...editsOnly, recorded: false}, none, FLAGS) ?? "",
  /no record of this form's last push/);
assert.equal(pushRefusal({dropped: [], edits: 0, recorded: false}, none, FLAGS),
  undefined);

console.log("tally compare tests OK");
