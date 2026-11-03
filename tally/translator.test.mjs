#!/usr/bin/env node
// Tests for the Tally translator: the blocks and settings a form becomes, in
// the shapes Tally has accepted. A shape here that Tally would refuse, or
// accept and then never act on, fails a push long after the code passed, so
// each is pinned exactly.
import {strict as assert} from "node:assert";

import {fixtureForm} from "./fixture.mjs";
import {FormIndex} from "./form-index.mjs";
import {stableUuid} from "./address.mjs";
import {
  blockNames, rulesOf, tallyPageNumber, toBlocks, toSettings,
} from "./translator.mjs";
import {ACTION_TYPES, BLOCK_TYPES, COMPARISONS} from "./vocabulary.mjs";

/** @import {FormDefinition} from "./index.d.mts" */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const blocks = toBlocks(fixtureForm);
const byUuid = new Map(blocks.map((b) => [b.uuid, b]));
/** @param {string} path */
const id = (path) => stableUuid(fixtureForm.key, path);
/** @param {string} path */
const blockAt = (path) => {
  const block = byUuid.get(id(path));
  if (!block) throw new Error(`no block at ${path}`);
  return block;
};
/** @param {string} path */
const logicAt = (path) => {
  const {payload} = blockAt(path);
  return {
    /** @type {{type: string, payload: Record<string, any>}[]} */
    conditionals: /** @type {any} */ (payload.conditionals),
    /** @type {{uuid: string, type: string, payload?: Record<string, any>}[]} */
    actions: /** @type {any} */ (payload.actions),
  };
};

// stableUuid: the same for the same form and path, different otherwise, and
// shaped as a version 4 uuid, which Tally requires of option references.
assert.equal(stableUuid("f", "q/title"), stableUuid("f", "q/title"));
assert.notEqual(stableUuid("f", "a"), stableUuid("f", "b"));
assert.notEqual(stableUuid("f", "a"), stableUuid("g", "a"));
assert.match(stableUuid("f", "name/title"), UUID_V4);

// Every block has its own uuid, and the form opens with its title.
assert.equal(new Set(blocks.map((b) => b.uuid)).size, blocks.length);
assert.equal(blocks[0].type, BLOCK_TYPES.FormTitle);

// Pages break with their index counted from 0, the thank-you break last.
const breaks = blocks.filter((b) => b.type === BLOCK_TYPES.PageBreak);
assert.deepEqual(breaks.map((b) => b.payload.index), [0, 1, 2]);
assert.deepEqual(breaks.at(-1)?.payload,
  {index: 2, isFirst: false, isLast: true, isThankYouPage: true});
assert.equal(breaks.filter((b) => b.payload.isLast === true).length, 1);

// A conditional question's title, help and input hide together, and its
// show logic, placed before it, names every one of their groups.
const hidden = blocks.filter((b) => [id("plan_date/title/group"),
  id("plan_date/help/text/group"), id("plan_date/input")].includes(b.groupUuid));
assert.deepEqual(hidden.map((b) => b.type),
  [BLOCK_TYPES.Title, BLOCK_TYPES.Text, BLOCK_TYPES.InputDate]);
assert.ok(hidden.every((b) => b.payload.isHidden === true));
const show = logicAt("plan_date/show/logic");
assert.deepEqual(show.conditionals[0].payload, {
  field: {uuid: id("plan/input"), type: "INPUT_FIELD", questionType: "MULTIPLE_CHOICE",
    blockGroupUuid: id("plan/input"), title: "Do you have a plan?"},
  comparison: COMPARISONS.Is,
  value: id("plan/option/yes"),
});
assert.deepEqual(show.actions[0].payload?.showBlocks,
  [id("plan_date/title/group"), id("plan_date/help/text/group"),
    id("plan_date/input")]);
const order = (/** @type {string} */ path) => blocks.indexOf(blockAt(path));
assert.ok(order("plan_date/show/logic") < order("plan_date/title"));

// A number's range goes into its input, unless it words its own stop.
assert.deepEqual(blockAt("salary/input/block").payload, {
  isRequired: true, isHidden: false,
  hasMinNumber: true, minNumber: 1_000, hasMaxNumber: true, maxNumber: 500_000,
  placeholder: "£", format: "POUND", prefix: "£",
});
assert.equal(blockAt("count/input/block").payload.hasMinNumber, undefined);
assert.deepEqual(rulesOf(fixtureForm.pages[0]).map((r) => r.key),
  ["salary-per", "started-before-born", "skip-choices", "count-range"]);

// Dates take the locale's format, and refuse the future only when asked.
assert.deepEqual(blockAt("born/input/block").payload, {
  isRequired: true, isHidden: false, format: "dd/MM/yyyy",
  disableDays: ["IN_THE_FUTURE"], dateRange: {from: "1940-01-01", to: "2010-01-01"},
});
assert.equal(blockAt("plan_date/input/block").payload.disableDays, undefined);

// An email is verified only when asked.
assert.equal(blockAt("email/input/block").payload.requireVerification, true);

// A choice question's first option turns Tally's A/B/C badges off when the
// form has none; a dropdown never carries the setting.
assert.deepEqual(byUuid.get(id("plan/option/yes"))?.payload,
  {isRequired: true, isHidden: false, index: 0, isFirst: true, isLast: false,
    text: "Yes", hasBadge: false, badgeType: "OFF"});
assert.equal(byUuid.get(id("region/option/north"))?.payload.hasBadge, undefined);
const badged = toBlocks({...fixtureForm,
  settings: {...fixtureForm.settings, badges: true}});
assert.equal(badged.find((b) => b.uuid === id("plan/option/yes"))?.payload.hasBadge,
  undefined);

// Hidden fields are one block, read by a condition (IS_EMPTY on a field the
// embed left out) and by a ratio dividing by one, each reference naming the
// field's own uuid and the block's group, or it never fires.
const fieldsBlock = blockAt("context/hidden");
const fields = /** @type {{uuid: string, name: string}[]} */ (
  fieldsBlock.payload.hiddenFields);
assert.deepEqual(fields.map((f) => f.name), ["source", "divisor"]);
/** @param {number} i */
const ref = (i) => ({uuid: fields[i].uuid, type: "HIDDEN_FIELD",
  questionType: "HIDDEN_FIELDS", blockGroupUuid: fieldsBlock.groupUuid,
  title: fields[i].name});
assert.deepEqual(logicAt("no-source/show/logic").conditionals[0].payload,
  {field: ref(0), comparison: COMPARISONS.IsEmpty, value: null});
const ratio = logicAt("salary-per/logic");
assert.deepEqual(ratio.conditionals.map((c) => c.payload.comparison),
  [COMPARISONS.IsNotEmpty, COMPARISONS.IsNotEmpty]);
assert.deepEqual(ratio.actions.map((a) => a.payload?.calculate.operator),
  ["ASSIGNMENT", "DIVISION"]);
assert.deepEqual(ratio.actions[1].payload?.calculate.value, ref(1));

// A reject shows its hidden message and hides the button, with no payload:
// Tally refuses one on that action. A hidden note is shown by its block
// beside its group, or Tally never shows it.
const message = blockAt("started-before-born/text");
assert.equal(message.payload.isHidden, true);
const reject = logicAt("started-before-born/logic");
assert.deepEqual(reject.actions.map((a) => a.type),
  [ACTION_TYPES.ShowBlocks, ACTION_TYPES.HideButton]);
assert.equal("payload" in reject.actions[1], false);
assert.deepEqual(reject.actions[0].payload,
  {showBlocks: [message.groupUuid, message.uuid]});
assert.equal(reject.conditionals[0].payload.comparison, COMPARISONS.IsBefore);
assert.equal(reject.conditionals[0].payload.value.uuid, id("born/input"));

// A jump names its page counted from 1.
assert.deepEqual(logicAt("skip-choices/logic").actions[0], {
  uuid: id("skip-choices/then/0"),
  type: ACTION_TYPES.JumpToPage,
  payload: {jumpToPage: tallyPageNumber(2)},
});
assert.equal(tallyPageNumber(0), 1);

// Outside a range is one OR group of two comparisons; "either" is another,
// and fixed dates are compared as ISO strings.
const why = logicAt("why/show/logic").conditionals;
assert.deepEqual(why.map((c) => c.type), ["GROUP", "GROUP"]);
assert.deepEqual(why[0].payload.conditionals.map(
  (/** @type {any} */ c) => c.payload.comparison),
[COMPARISONS.LessThan, COMPARISONS.GreaterThan]);
assert.deepEqual(why[1].payload.conditionals.map(
  (/** @type {any} */ c) => [c.payload.comparison, c.payload.value]),
[[COMPARISONS.IsBefore, "2008-04-01"], [COMPARISONS.IsAfter, "2008-03-31"]]);

// What the translator refuses, because Tally would accept it and never act.
/** @param {FormDefinition} form @param {RegExp} message */
const refuses = (form, message) => assert.throws(() => toBlocks(form), message);
const [first, ...rest] = fixtureForm.pages;
refuses({...fixtureForm, pages: [{...first, items: [...first.items, first.items[1]]},
  ...rest]}, /share the key name/);
refuses({...fixtureForm, pages: [{...first, items: [...first.items,
  {kind: "hiddenFields", key: "more", fields: ["name"]}]}, ...rest]},
/share the name name/);
refuses({...fixtureForm, pages: [first, {...rest[0], items: rest[0].items.map((q) =>
  q.kind === "date"
    ? {...q, showWhen: [{kind: /** @type {const} */ ("chose"), question: "plan",
      options: ["maybe"]}]}
    : q)}, rest[1]]}, /has no option maybe/);
refuses({...fixtureForm, pages: [{...first, rules: [
  {kind: "jump", key: "nowhere", to: "missing", when: []}]}, ...rest]},
/no page missing/);

// Every block written has a name, for a diff to print.
const name = blockNames(fixtureForm);
for (const block of blocks) assert.doesNotMatch(name(block.uuid), /^unknown block/);
assert.equal(name(id("plan/title")), "plan title");
assert.equal(name(id("started-before-born/logic")), "started-before-born logic");
assert.match(name("nope"), /^unknown block nope/);

// Settings: the confirmation email mentions the email question's answer, in
// the shape Tally stored when probed; absent, it is switched off.
const email = {to: "email", fromName: "Us", replyTo: "us@example.com",
  subject: "Your answers", body: "Thanks.", attachPdf: true};
const withEmail = toSettings({...fixtureForm, confirmationEmail: email});
assert.ok("respondentEmailTo" in withEmail);
const answer = {uuid: id("email/input"), type: "INPUT_FIELD",
  questionType: "INPUT_EMAIL",
  blockGroupUuid: id("email/input"), title: "Your email"};
assert.deepEqual(withEmail.respondentEmailTo.mentions[0].field, answer);
assert.deepEqual(withEmail.respondentEmailTo.safeHTMLSchema, [["@Your email",
  [["tag", "span"], ["mention", withEmail.respondentEmailTo.mentions[0].uuid]]]]);
assert.equal(withEmail.respondentEmailAttachPdf, true);
assert.equal(toSettings(fixtureForm).hasRespondentEmailNotifications, false);
assert.throws(
  () => toSettings({...fixtureForm, confirmationEmail: {...email, to: "name"}}),
  /name is not an email question/);

// The badge choice is the translator's, never sent as a setting.
assert.equal("badges" in toSettings(fixtureForm), false);

// The owner's notification replies to the respondent's answer; absent, the
// push leaves Tally's own setting alone.
const notified = toSettings({...fixtureForm,
  notification: {to: "owner@example.com", subject: "New message", replyTo: "email"}});
assert.ok("selfEmailReplyTo" in notified);
assert.equal(notified.hasSelfEmailNotifications, true);
assert.deepEqual(notified.selfEmailReplyTo.mentions[0].field, answer);
assert.deepEqual(notified.selfEmailTo,
  {safeHTMLSchema: [["owner@example.com"]], mentions: []});
assert.equal("hasSelfEmailNotifications" in toSettings(fixtureForm), false);
assert.throws(() => toSettings({...fixtureForm,
  notification: {to: "o@example.com", subject: "s", replyTo: "name"}}),
/name is not an email question/);

// FormIndex: the uuids a site's styling targets, refusing what isn't there.
const index = new FormIndex(fixtureForm);
assert.equal(index.title("plan"), id("plan/title"));
assert.equal(index.input("salary"), id("salary/input/block"));
assert.equal(index.option("plan", "no"), id("plan/option/no"));
assert.deepEqual(index.options("region"),
  [id("region/option/north"), id("region/option/south")]);
assert.deepEqual(index.questionBlocks("plan_date"),
  [id("plan_date/title"), id("plan_date/help/text"), id("plan_date/input/block")]);
assert.deepEqual(index.questionBlocks("region"), [id("region/title"),
  id("region/input"), id("region/option/north"), id("region/option/south")]);
assert.deepEqual(index.stopMessages(),
  [id("started-before-born/text"), id("count-range/text")]);
assert.throws(() => index.option("plan", "maybe"), /has no option plan\/maybe/);
assert.throws(() => index.options("salary"), /salary has no options/);
assert.throws(() => index.title("nope"), /has no question nope/);
// Every uuid the index gives is one the translator writes, as a block or a
// group, so the two can't spell an address differently.
const written = new Set(blocks.flatMap((b) => [b.uuid, b.groupUuid]));
const indexed = [
  ...index.stopMessages(),
  ...[...index.questions.keys()].flatMap((key) => index.questionBlocks(key)),
];
for (const uuid of indexed) assert.ok(written.has(uuid), `${uuid} is not written`);
assert.throws(() => new FormIndex({...fixtureForm, pages: [...fixtureForm.pages,
  fixtureForm.pages[0]]}), /share the key/);

console.log("tally translator tests OK");
