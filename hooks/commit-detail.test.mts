#!/usr/bin/env node
// What a commit's confirmation prompt shows: the one form it reads, and a
// plain line for any other.
import {strict as assert} from "node:assert";
import {commitDetail, parseCommit} from "./lib/commit-detail.mts";

const COMMIT = "git -C /r/app commit -F /msgs/m.txt";

/** Stands in for git in these tests: answers every call with the given
 *  text, as `git diff --cached --name-status` would print it. */
const staged = (files: string) => () => files;

const checks: [string, () => void][] = [
  ["the form gives its repo and message file", () =>
    assert.deepEqual(parseCommit(COMMIT),
      {repo: "/r/app", messageFile: "/msgs/m.txt"})],
  ["any other command is not read", () => {
    for (const command of [
      "git commit -F /msgs/m.txt",
      "git -C app commit -F /msgs/m.txt",
      "git -C /r/app commit -F m.txt",
      'git -C /r/app commit -m "x"',
      "git  -C /r/app commit -F /msgs/m.txt",
      `${COMMIT} -a`,
      // A path word that carries a second command.
      "git -C /r commit -F /m;git${IFS}push",
      "git -C /r commit -F /m&&rm${IFS}-rf${IFS}x",
      "git -C /r$(touch${IFS}x) commit -F /m",
    ]) assert.equal(parseCommit(command), undefined, command);
  }],
  ["the detail shows repo, staged files and message", () =>
    assert.equal(
      commitDetail(COMMIT, staged("M\ta.ts\nA\tb.ts\n"), () => "Add b\n\nWhy.\n"),
      "Repo: app (/r/app)\nStaged:\n  M\ta.ts\n  A\tb.ts\n"
        + "Message:\n  Add b\n  \n  Why.",
    )],
  ["a part that can't be read leaves the others", () => {
    const detail = commitDetail(COMMIT, staged("M\ta.ts"),
      () => { throw new Error("ENOENT m.txt"); });
    assert.match(detail, /^Repo: app/);
    assert.match(detail, /Staged:\n {2}M\ta\.ts/);
    assert.match(detail, /Couldn't read the message: ENOENT m\.txt/);
  }],
  ["any other command names the form", () =>
    assert.match(commitDetail('git commit -m "x"'),
      /^Not in the form `git -C <absolute repo path> commit -F/)],
];

let pass = 0;
const fail: string[] = [];
for (const [name, check] of checks) {
  try {
    check();
    pass++;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    fail.push(`"${name}": ${why}`);
  }
}
if (fail.length) {
  console.error(`✖ commit-detail tests: ${fail.length} failed\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
console.log(`commit-detail tests OK — ${pass} passed`);
