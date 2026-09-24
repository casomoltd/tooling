#!/usr/bin/env node
// Tests for the personal-data rules. Every fixture below is invented: the
// point of each is the shape it has, and a real value would be the leak.
import {strict as assert} from "node:assert";
import {findPersonalData, identityRules, scan} from "./check-personal-data.mjs";

const rules = identityRules();
const found = (text, names) =>
  findPersonalData(text, rules, names).map((h) => h.rule);

// Each identity shape is found.
assert.deepEqual(found("write to someone@mailbox.test.uk"), ["email address"]);
assert.deepEqual(found("NI: JK 12 34 56 C"), ["National Insurance number"]);
assert.deepEqual(found("call 07700 900123"), ["UK mobile number"]);
assert.deepEqual(found("<td>Date of birth</td><td>1983-07-14</td>"),
  ["date of birth"]);
assert.deepEqual(found("{label: 'Date of birth', value: {value: '14 July 1983'}}"),
  ["date of birth"]);
assert.deepEqual(found("const dateOfBirth = new Date(1983, 6, 14);"),
  ["date of birth"]);

// What is not a person stays quiet.
assert.deepEqual(found("postcss@8.4.31 and author@example.com"), []);
assert.deepEqual(found("Remedy window closed 2022-03-31"), []);
assert.deepEqual(found("Date of birth: 1980-01-01"), []);          // placeholder
assert.deepEqual(found("dob = new Date(1980, 0, 1)"), []);          // placeholder

// A repo's own allowed domains and rules come from its config.
assert.deepEqual(
  findPersonalData("hello@our-org.org", identityRules([/@our-org\.org$/])), []);
const withRef = [...rules, {name: "case reference", re: /\bCASE-\d{4,}\b/g,
  allow: (m) => m === "CASE-0000"}];
assert.deepEqual(
  findPersonalData("see CASE-0042, not CASE-0000", withRef).map((h) => h.text),
  ["CASE-0042"]);

// The denylist matches whole words, case-insensitively, on every line.
assert.deepEqual(found("Alias Example wrote\nalias example again", ["Alias Example"]),
  ["name on the local denylist", "name on the local denylist"]);

// A file that cannot be read is reported with its reason, never skipped.
const scanned = scan(["a.txt", "b.txt"], (file) => {
  if (file === "b.txt") throw Object.assign(new Error("no"), {code: "EACCES"});
  return "nothing here";
}, rules, []);
assert.deepEqual(scanned.hits, []);
assert.deepEqual(scanned.unread, [{file: "b.txt", code: "EACCES"}]);

console.log("check-personal-data tests OK");
