#!/usr/bin/env node
// Tests for the agent-preload rule. Each runs against a throwaway repo and a
// throwaway house-skills directory, so they assert the resolution RULES, not
// whichever skills tooling ships today.
import {strict as assert} from "node:assert";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import remarkLintAgentPreloads, {
  preloadNames,
  resolves,
} from "./remark-lint-agent-preloads.mjs";

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

const root = mkdtempSync(join(tmpdir(), "agent-preloads-"));
const repo = join(root, "repo");
const houseDir = join(root, "house");
const addSkill = (dir, name) => {
  mkdirSync(join(dir, name), {recursive: true});
  writeFileSync(join(dir, name, "SKILL.md"), "---\nname: x\n---\n");
};
addSkill(join(repo, "skills"), "repo-skill");
addSkill(join(repo, ".claude", "skills"), "dot-skill");
addSkill(houseDir, "house-skill");
const opts = {cwd: repo, houseDir};

/** Runs the plugin over one file's frontmatter; returns its messages. */
function lint(filePath, frontmatter) {
  const messages = [];
  const file = {path: filePath, message: (text) => messages.push(text)};
  const tree = {children: [{type: "yaml", value: frontmatter}]};
  remarkLintAgentPreloads(opts)(tree, file);
  return messages;
}

it("reads an inline comma list", () => {
  assert.deepEqual(preloadNames("name: a\nskills: x, y\n"), ["x", "y"]);
});
it("reads a bracketed, quoted inline list", () => {
  assert.deepEqual(preloadNames("skills: ['x', \"y\"]"), ["x", "y"]);
});
it("reads a block list and stops at the next key", () => {
  assert.deepEqual(preloadNames("skills:\n  - x\n  - y\ntools: Read\n"), ["x", "y"]);
});
it("reads a flush block list and CRLF line ends", () => {
  const crlf = "skills:\r\n- x\r\n- y\r\ntools: Read\r\n";
  assert.deepEqual(preloadNames(crlf), ["x", "y"]);
});
it("drops a trailing comment", () => {
  assert.deepEqual(preloadNames("skills: x, y # the rubrics\n"), ["x", "y"]);
});
it("tells an absent field from an empty one", () => {
  assert.equal(preloadNames("name: a\ndescription: b\n"), undefined);
  assert.deepEqual(preloadNames("skills:\ntools: Read\n"), []);
});

it("resolves a repo skill under skills/ and under .claude/skills/", () => {
  assert.ok(resolves("repo-skill", opts));
  assert.ok(resolves("dot-skill", opts));
});
it("resolves a house skill bare or as casomoltd:", () => {
  assert.ok(resolves("house-skill", opts));
  assert.ok(resolves("casomoltd:house-skill", opts));
});
it("refuses casomoltd: on a skill only the repo holds", () => {
  assert.ok(!resolves("casomoltd:repo-skill", opts));
});
it("refuses another plugin's skill and a misspelt name", () => {
  assert.ok(!resolves("other:house-skill", opts));
  assert.ok(!resolves("house-skil", opts));
});

it("reports each unresolved preload in an agent brief", () => {
  const messages = lint("agents/a.md", "skills: house-skill, nope, other:x");
  assert.equal(messages.length, 2);
  assert.match(messages[0], /"nope"/);
  assert.match(messages[1], /"other:x"/);
});
it("reports a skills: field that names nothing", () => {
  assert.equal(lint("agents/a.md", "skills:\ntools: Read").length, 1);
});
it("ignores a file outside an agents/ directory", () => {
  assert.deepEqual(lint("skills/s/SKILL.md", "skills: nope"), []);
});

rmSync(root, {recursive: true, force: true});

if (fail.length) {
  console.error(`remark-lint-agent-preloads: ${fail.length} failed`);
  for (const f of fail) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`remark-lint-agent-preloads: ${pass} passed`);
