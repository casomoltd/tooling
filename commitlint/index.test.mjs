#!/usr/bin/env node
// Tests for the no-ai-attribution rule. The rule is pure over a parsed commit,
// so these assert the RULE rather than any repo's history.
//
// The path exemption is the part worth testing. A rule that greps a lowercased
// message for "claude" cannot tell attribution from a filename, and a repo whose
// instruction file is CLAUDE.md then cannot write a commit naming the file it
// changed. Stripping paths fixes that and must not open a hole: the last group
// below is a commit that both edits such a path and carries a real trailer.
import {strict as assert} from "node:assert";
import {createRequire} from "node:module";

const rule = createRequire(import.meta.url)("./index.cjs").plugins[0].rules["no-ai-attribution"];
const check = (header, body = "", footer = "") => rule({header, body, footer})[0];

let pass = 0;
const fail = [];
const it = (name, fn) => {
  try {
    fn();
    pass++;
  } catch (err) {
    fail.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
};

it("a path to the instruction file is not attribution", () => {
  assert.equal(check("docs: rewrite the CLAUDE.md invariants"), true);
  assert.equal(check("docs: state it in CLAUDE.md", "moved out of docs/CLAUDE.md"), true);
});

it("a path under the config directory is not attribution", () => {
  assert.equal(check("chore: move agents into .claude/agents/"), true);
  assert.equal(check("fix: register the skill", "symlinked from ~/.claude/skills"), true);
});

it("a trailer is still refused, which is what the rule is for", () => {
  assert.equal(check("feat: a thing", "", "Co-Authored-By: Claude <noreply@anthropic.com>"), false);
  assert.equal(check("feat: generated with Claude Code"), false);
  assert.equal(check("chore: anthropic housekeeping"), false);
});

it("stripping a path does not excuse the rest of the message", () => {
  // The hole this would open if the exemption allow-listed whole messages
  // rather than removing the paths from them.
  assert.equal(check("docs: update CLAUDE.md", "", "Co-Authored-By: Claude"), false);
  assert.equal(check("docs: update CLAUDE.md", "claude wrote most of this"), false);
  assert.equal(check("chore: tidy .claude/settings.json", "", "Co-Authored-By: someone"), false);
});

if (fail.length) {
  console.error(`✖ commitlint tests: ${fail.length} failed\n  ` + fail.join("\n  "));
  process.exit(1);
}
console.log(`commitlint tests OK — ${pass} assertions passed`);
