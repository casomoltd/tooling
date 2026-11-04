#!/usr/bin/env node
// What a commit's confirmation prompt shows: the one form it reads, and what
// it says of a commit in that form.
import {strict as assert} from "node:assert";
import {describe, it} from "node:test";
import {commitDetail, parseCommit} from "./lib/commit-detail.mts";

const COMMIT = {repo: "/r/app", messageFile: "/msgs/m.txt"};

/** Stands in for git in these tests: answers every call with the given
 *  text, as `git diff --cached --name-status` would print it. */
const staged = (files: string) => () => files;

describe("parseCommit", () => {
  it("reads the form's repo and message file", () => {
    assert.deepEqual(parseCommit("cd /r/app && git commit -F /msgs/m.txt"), COMMIT);
  });

  for (const command of [
    "git commit -F /msgs/m.txt",
    "git -C /r/app commit -F /msgs/m.txt",
    "cd app && git commit -F /msgs/m.txt",
    "cd /r/app && git commit -F m.txt",
    'cd /r/app && git commit -m "x"',
    "cd /r/app  && git commit -F /msgs/m.txt",
    "cd /r/app && git commit -F /msgs/m.txt -a",
    // A path word that carries a second command.
    "cd /r && git commit -F /m;git${IFS}push",
    "cd /r && git commit -F /m&&rm${IFS}-rf${IFS}x",
    "cd /r$(touch${IFS}x) && git commit -F /m",
  ]) {
    it(`reads no commit from: ${command}`, () => {
      assert.equal(parseCommit(command), undefined);
    });
  }
});

describe("commitDetail", () => {
  it("shows the repo, the staged files and the message", () => {
    assert.equal(
      commitDetail(COMMIT, staged("M\ta.ts\nA\tb.ts\n"), () => "Add b\n\nWhy.\n"),
      "Repo: app (/r/app)\nStaged:\n  M\ta.ts\n  A\tb.ts\n"
        + "Message:\n  Add b\n  \n  Why.",
    );
  });

  it("says which part it couldn't read, and shows the others", () => {
    const detail = commitDetail(COMMIT, staged("M\ta.ts"),
      () => { throw new Error("ENOENT m.txt"); });
    assert.match(detail, /^Repo: app/);
    assert.match(detail, /Staged:\n {2}M\ta\.ts/);
    assert.match(detail, /Couldn't read the message: ENOENT m\.txt/);
  });
});
