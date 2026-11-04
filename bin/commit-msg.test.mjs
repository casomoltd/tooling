#!/usr/bin/env node
// The commit-message gate, run as a commit runs it (bin/commit-msg.sh with
// this repo's config). Attribution trailers parse as the footer, which
// no-ai-attribution must scan: a header-and-body check misses the very line
// the rule exists to catch.
import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {after, it} from "node:test";
import {fileURLToPath} from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "commit-msg-test-"));
after(() => rmSync(dir, {recursive: true, force: true}));

// The gate's listed-file check reads the repo's index, so a draft is linted
// against an index of its own, built from HEAD with nothing staged: a listed
// file staged for a real commit would otherwise fail the passing case here.
const env = {...process.env, GIT_INDEX_FILE: join(dir, "index")};
const built = spawnSync("git", ["read-tree", "HEAD"],
  {cwd: REPO_ROOT, env, encoding: "utf8"});
if (built.status !== 0) throw new Error(`git read-tree HEAD failed: ${built.stderr}`);

/** The gate's exit status on a message. */
const lint = (name, content) => {
  const file = join(dir, name);
  writeFileSync(file, content);
  return spawnSync("sh", [join(REPO_ROOT, "bin", "commit-msg.sh"), file],
    {cwd: REPO_ROOT, env, encoding: "utf8"}).status;
};

it("refuses an attribution trailer", () => {
  assert.notEqual(lint("trailer", "fix: tidy\n\nCo-Authored-By: X\n"), 0);
});

it("passes a clean message", () => {
  assert.equal(lint("clean", "fix: tidy the hook tests\n"), 0);
});
