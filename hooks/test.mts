#!/usr/bin/env node
// Guard tests, in two layers:
//   1. Registry cases (test-cases.mts): evaluate(RULES, toolInput) directly.
//      Types prove the output SHAPE; these prove the rule LOGIC.
//   2. End to end: spawn a guard with a piped payload and read its decision,
//      including that malformed or empty input asks.
// Run with `node hooks/test.mts`; wired into `npm run check`.
import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {after, describe, it} from "node:test";
import {evaluate, reasonFor} from "./lib/run.mts";
import {VERDICTS, type Rule} from "./lib/rule.mts";
import {bashCases, editCases} from "./test-cases.mts";
import {RULES as BASH_RULES} from "./guard-bash.mts";
import {RULES as EDIT_RULES} from "./guard-edit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("the Bash rules", () => {
  for (const {verdict, id, command} of bashCases) {
    it(`${verdict ?? "allows"}: ${command}`, () => {
      const got = evaluate(BASH_RULES, {command});
      assert.equal(got?.verdict ?? null, verdict);
      if (id) assert.equal(got?.id, id);
    });
  }
});

describe("the Edit and Write rules", () => {
  for (const {verdict, id, ...input} of editCases) {
    it(`${verdict ?? "allows"}: ${input.file_path}`, () => {
      const got = evaluate(EDIT_RULES, input);
      assert.equal(got?.verdict ?? null, verdict);
      if (id) assert.equal(got?.id, id);
    });
  }
});

it("a rule's detail that throws leaves the reason alone", () => {
  const rule: Rule = {
    id: "r", verdict: VERDICTS.Ask, reason: "Confirm.", matches: () => true,
    detail: () => { throw new Error("boom"); },
  };
  assert.equal(reasonFor(rule, {}), "Confirm.");
});

it("a rule whose match throws is no match, and says so", () => {
  const rule: Rule = {
    id: "broken", verdict: VERDICTS.Deny, reason: "No.",
    matches: () => { throw new Error("bad regex"); },
  };
  const logged: string[] = [];
  const write = process.stderr.write;
  process.stderr.write = (chunk: string | Uint8Array) => {
    logged.push(String(chunk));
    return true;
  };
  try {
    assert.equal(evaluate([rule], {}), null);
  } finally {
    process.stderr.write = write;
  }
  assert.match(logged.join(""), /broken: its match failed \(bad regex\)/);
});

/** A guard run with a piped payload, its output as strings: by its path, or
 *  by any other, a symlink to it say. */
const run = (script: string, payload: unknown, path = join(HERE, script)) => {
  const r = spawnSync("node", [path], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });
  return {status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? ""};
};

/** The decision a guard printed, or undefined for none. */
const decisionOf = (stdout: string) =>
  stdout.trim() ? JSON.parse(stdout).hookSpecificOutput : undefined;

describe("a guard, run end to end", () => {
  it("runs when reached through a symlink, as a plugin's may be", () => {
    const dir = mkdtempSync(join(tmpdir(), "guard-link-"));
    after(() => rmSync(dir, {recursive: true, force: true}));
    const link = join(dir, "guard-bash.mts");
    symlinkSync(join(HERE, "guard-bash.mts"), link);
    const r = run("guard-bash.mts", {
      tool_name: "Bash", tool_input: {command: "git push --force"},
    }, link);
    assert.equal(decisionOf(r.stdout).permissionDecision, "deny");
  });

  it("prints a deny", () => {
    const r = run("guard-bash.mts", {
      tool_name: "Bash", tool_input: {command: "git push --force"},
    });
    assert.equal(r.status, 0);
    assert.equal(decisionOf(r.stdout).permissionDecision, "deny");
  });

  it("prints an ask", () => {
    const r = run("guard-bash.mts", {
      tool_name: "Bash", tool_input: {command: "git push origin main"},
    });
    assert.equal(decisionOf(r.stdout).permissionDecision, "ask");
  });

  it("prints nothing for a command no rule matches", () => {
    const r = run("guard-bash.mts", {
      tool_name: "Bash", tool_input: {command: "git status"},
    });
    assert.equal(r.status, 0);
    assert.equal(decisionOf(r.stdout), undefined);
  });

  it("asks, and says why on stderr, when the input isn't JSON", () => {
    const r = run("guard-bash.mts", "{not json");
    assert.equal(decisionOf(r.stdout).permissionDecision, "ask");
    assert.ok(r.stderr.includes("[casomoltd hooks]"));
  });

  it("asks on empty input", () => {
    const r = run("guard-edit.mts", "");
    assert.equal(decisionOf(r.stdout).permissionDecision, "ask");
  });

  it("asks when the payload has no tool_input", () => {
    const r = run("guard-bash.mts", {tool_name: "Bash"});
    assert.equal(decisionOf(r.stdout).permissionDecision, "ask");
  });
});

describe("a commit's prompt, run end to end", () => {
  // A real repo with a staged file and a message file.
  const repo = mkdtempSync(join(tmpdir(), "commit-prompt-"));
  spawnSync("git", ["init", "-q", repo]);
  writeFileSync(join(repo, "a.txt"), "a\n");
  spawnSync("git", ["-C", repo, "add", "a.txt"]);
  writeFileSync(join(repo, "msg.txt"), "Add a\n\nBecause a.\n");
  after(() => rmSync(repo, {recursive: true, force: true}));

  it("shows its repo, files and message", () => {
    const r = run("guard-bash.mts", {
      tool_name: "Bash",
      tool_input: {command: `cd ${repo} && git commit -F ${join(repo, "msg.txt")}`},
    });
    const reason: string = decisionOf(r.stdout).permissionDecisionReason;
    assert.match(reason, /Repo: commit-prompt-/);
    assert.match(reason, /Staged:\n {2}A\ta\.txt/);
    assert.match(reason, /Message:\n {2}Add a\n {2}\n {2}Because a\./);
  });
});
