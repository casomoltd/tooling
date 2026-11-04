#!/usr/bin/env node
// Guard tests. Two layers:
//   1. Pure registry assertions — call evaluate(RULES, toolInput) directly.
//      Types prove the output SHAPE; these prove the rule LOGIC (a type can't
//      check a regex), which is the bulk of the value.
//   2. End-to-end IO — spawn the guard with a piped payload and assert it emits
//      a decision, plus that malformed/empty input fails open.
// Run via `node hooks/test.mts`; wired into `npm run check`.
import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {evaluate, reasonFor} from "./lib/run.mts";
import type {Rule} from "./lib/rule.mts";
import {bashCases, editCases, type Case} from "./test-cases.mts";
import {RULES as BASH_RULES} from "./guard-bash.mts";
import {RULES as EDIT_RULES} from "./guard-edit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");


let pass = 0;
const fail: string[] = [];

// One bookkeeping loop for every case list — a missed `pass++` in a
// hand-rolled copy would skew the totals invisibly.
const runCases = <T,>(cases: readonly T[], check: (c: T) => void): void => {
  for (const c of cases) {
    try {
      check(c);
      pass++;
    } catch (err) {
      fail.push(err instanceof Error ? err.message : String(err));
    }
  }
};

const checkRegistry = (
  label: string,
  rules: readonly Rule[],
  cases: Case[],
): void => {
  runCases(cases, (c) => {
    const {verdict, id, ...input} = c;
    const got = evaluate(rules, input);
    const gotVerdict = got?.verdict ?? null;
    assert.equal(gotVerdict, verdict, `verdict for ${label}: ${JSON.stringify(input)}`);
    if (id) assert.equal(got?.id, id, `rule id for ${label}: ${JSON.stringify(input)}`);
  });
};

checkRegistry("bash", BASH_RULES, bashCases);
checkRegistry("edit", EDIT_RULES, editCases);

// ---- commitlint config regression -----------------------------------------
// Attribution trailers are parsed as `footer`, which no-ai-attribution must
// scan — a header+body check misses the very line the rule exists to catch.
// Run through this repo's own gate (bin/commit-msg.sh + the root config).
const msgDir = mkdtempSync(join(tmpdir(), "commitlint-test-"));
// The gate's listed-file check reads the repo's index, so a draft is linted
// against an index of its own, built from HEAD with nothing staged. Without
// it, a listed file staged for the real commit fails the passing case here.
const draftEnv = {...process.env, GIT_INDEX_FILE: join(msgDir, "index")};
const built = spawnSync("git", ["read-tree", "HEAD"],
  {cwd: REPO_ROOT, env: draftEnv, encoding: "utf8"});
if (built.status !== 0) throw new Error(`git read-tree HEAD failed: ${built.stderr}`);
const lintDraft = (name: string, content: string): number | null => {
  const file = join(msgDir, name);
  writeFileSync(file, content);
  const r = spawnSync("sh", [join(REPO_ROOT, "bin", "commit-msg.sh"), file], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: draftEnv,
  });
  return r.status;
};
runCases(
  [
    {
      name: "attribution trailer rejected",
      content: "fix: tidy\n\nCo-Authored-By: X\n",
      passes: false,
    },
    {name: "clean message passes", content: "fix: tidy the hook tests\n", passes: true},
  ],
  (c) => {
    const status = lintDraft(c.name.replaceAll(" ", "-"), c.content);
    if (c.passes) assert.equal(status, 0, c.name);
    else assert.notEqual(status, 0, c.name);
  },
);
rmSync(msgDir, {recursive: true, force: true});

// A rule's detail is read after its match; one that throws leaves the reason.
try {
  const rule: Rule = {
    id: "r", verdict: "ask", reason: "Confirm.", matches: () => true,
    detail: () => { throw new Error("boom"); },
  };
  assert.equal(reasonFor(rule, {}), "Confirm.");
  pass++;
} catch (err) {
  fail.push(`reasonFor: ${err instanceof Error ? err.message : String(err)}`);
}

// A real repo with a staged file and a message file, for the prompt's text.
const commitRepo = mkdtempSync(join(tmpdir(), "commit-prompt-"));
spawnSync("git", ["init", "-q", commitRepo]);
writeFileSync(join(commitRepo, "a.txt"), "a\n");
spawnSync("git", ["-C", commitRepo, "add", "a.txt"]);
writeFileSync(join(commitRepo, "msg.txt"), "Add a\n\nBecause a.\n");

// End-to-end: spawn the real script with a piped payload. Normalise the result
// so stdout/stderr are strings regardless of platform buffering.
interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
const run = (script: string, payload: unknown): RunResult => {
  const r = spawnSync("node", [join(HERE, script)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });
  return {
    status: r.status,
    stdout: typeof r.stdout === "string" ? r.stdout : "",
    stderr: typeof r.stderr === "string" ? r.stderr : "",
  };
};

interface E2E {
  name: string;
  res: RunResult;
  assert: (r: RunResult) => void;
}

const e2e: E2E[] = [
  {
    // contract.mts proves the output SHAPE at compile time; this only smoke-
    // checks that the process actually serialises a deny to stdout.
    name: "deny → stdout decision",
    res: run("guard-bash.mts", {
      tool_name: "Bash",
      tool_input: {command: "git push --force"},
    }),
    assert: (r) => {
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
    },
  },
  {
    name: "ask reaches stdout",
    res: run("guard-bash.mts", {
      tool_name: "Bash",
      tool_input: {command: "git push origin main"},
    }),
    assert: (r) => {
      assert.equal(r.status, 0);
      assert.match(r.stdout, /"permissionDecision":"ask"/);
    },
  },
  {
    // Clean evaluation, nothing matched -> allow SILENTLY (not a failure).
    name: "benign command produces no decision",
    res: run("guard-bash.mts",
      {tool_name: "Bash", tool_input: {command: "git status"}}),
    assert: (r) => {
      assert.equal(r.status, 0);
      assert.equal(r.stdout.trim(), "");
    },
  },
  {
    // Can't read the input -> ask the human, plus a stderr line.
    name: "malformed JSON asks (+ stderr)",
    res: run("guard-bash.mts", "{not json"),
    assert: (r) => {
      assert.equal(r.status, 0);
      assert.match(r.stdout, /"permissionDecision":"ask"/);
      assert.ok(r.stderr.includes("[casomoltd hooks]"));
    },
  },
  {
    name: "a commit's prompt shows its repo, files and message",
    res: run("guard-bash.mts", {
      tool_name: "Bash",
      tool_input: {
        command: `git -C ${commitRepo} commit -F ${join(commitRepo, "msg.txt")}`,
      },
    }),
    assert: (r) => {
      const reason: string = JSON.parse(r.stdout)
        .hookSpecificOutput.permissionDecisionReason;
      assert.match(reason, /Repo: commit-prompt-/);
      assert.match(reason, /Staged:\n {2}A\ta\.txt/);
      assert.match(reason, /Message:\n {2}Add a\n {2}\n {2}Because a\./);
    },
  },
  {
    name: "empty stdin asks",
    res: run("guard-edit.mts", ""),
    assert: (r) => {
      assert.equal(r.status, 0);
      assert.match(r.stdout, /"permissionDecision":"ask"/);
    },
  },
  {
    // Valid JSON but no tool_input at all -> ask (can't make sense of it).
    name: "no tool_input asks",
    res: run("guard-bash.mts", {tool_name: "Bash"}),
    assert: (r) => {
      assert.equal(r.status, 0);
      assert.match(r.stdout, /"permissionDecision":"ask"/);
    },
  },
];

for (const t of e2e) {
  try {
    t.assert(t.res);
    pass++;
  } catch (err) {
    fail.push(`e2e "${t.name}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

rmSync(commitRepo, {recursive: true, force: true});

if (fail.length) {
  console.error(`✖ hooks tests: ${fail.length} failed\n  ` + fail.join("\n  "));
  process.exit(1);
}
console.log(`hooks tests OK — ${pass} assertions passed`);
