#!/usr/bin/env node
// Tests for the listed-file check: which staged files it names, and which
// messages defer the tidy.
import {strict as assert} from "node:assert";
import {defers, listedInCommit} from "./check-listed-files.mjs";

const listed = {
  "src/options.ts": {"max-lines-per-function": {count: 2}, complexity: {count: 1}},
  "src/plans.ts": {"max-params": {count: 1}},
};

// A staged file on the list is named with its rules; others are not.
assert.deepEqual(listedInCommit(["src/options.ts", "src/other.ts"], listed), [
  {file: "src/options.ts", rules: ["max-lines-per-function", "complexity"]},
]);
// Nothing staged from the list, or no list at all: nothing to name.
assert.deepEqual(listedInCommit(["src/other.ts"], listed), []);
assert.deepEqual(listedInCommit(["src/options.ts"], {}), []);
// A key inherited from Object.prototype is not a listed file.
assert.deepEqual(listedInCommit(["toString"], listed), []);

// The trailer defers only with a reason, on a line of its own.
assert.equal(defers("Fix a typo\n\nLint-deferred: hotfix, tidy follows\n"), true);
assert.equal(defers("Fix a typo\n\nLint-deferred:\n"), false);
// An empty trailer does not borrow the next line as its reason.
assert.equal(defers("Fix a typo\n\nLint-deferred:\n# Please enter the message\n"),
  false);
// Git reads trailer keys without regard to case.
assert.equal(defers("Fix a typo\n\nlint-deferred: hotfix\n"), true);
assert.equal(defers("Fix a typo\n\nsee Lint-deferred: in the docs\n"), false);
assert.equal(defers("Fix a typo\n"), false);

console.log("check-listed-files tests OK");
