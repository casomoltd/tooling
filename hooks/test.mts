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
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {evaluate} from "./lib/run.mts";
import type {Rule, Verdict} from "./lib/rule.mts";
import {RULES as BASH_RULES} from "./guard-bash.mts";
import {RULES as EDIT_RULES} from "./guard-edit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

// verdict: expected verdict, or null for "no match (allowed)".
// id: optional — assert which rule fired.
interface Case {
  command?: string;
  file_path?: string;
  content?: string;
  new_string?: string;
  verdict: Verdict | null;
  id?: string;
}

const bashCases: Case[] = [
  {command: "git push origin main", verdict: "ask", id: "git-push-confirm"},
  {command: "git push --follow-tags", verdict: "ask"},
  {command: "git push --force origin main", verdict: "deny", id: "git-force-push"},
  {command: "git push -f", verdict: "deny", id: "git-force-push"},
  {command: "git push origin +main", verdict: "deny", id: "git-force-push"},
  // --force-with-lease is the safe variant: confirm, don't hard-block.
  {command: "git push --force-with-lease", verdict: "ask", id: "git-push-confirm"},
  {command: "git reset --hard HEAD~3", verdict: "deny", id: "git-reset-hard"},
  {command: "git rebase -i HEAD~2", verdict: "deny", id: "git-rebase-interactive"},
  {command: "git tag -d v1.0.0", verdict: "deny", id: "git-tag-delete"},
  {command: "git filter-branch --tree-filter x", verdict: "deny"},
  {command: "npm version major", verdict: "deny", id: "version-major"},
  {command: "uv version --bump major", verdict: "deny", id: "version-major"},
  {command: "npm i -g typescript", verdict: "deny", id: "npm-global-install"},
  {command: "npm install --global eslint", verdict: "deny"},
  // Allowed — no rule should fire.
  {command: "git status", verdict: null},
  {command: "git push --help", verdict: "ask"}, // still a push token; confirm
  {command: "npm version patch", verdict: null},
  {command: "npm i -D eslint", verdict: null},
  // commit AI-attribution is commitlint's job, not the hook's — no rule fires.
  {command: 'git commit -m "feat: x" -m "Co-Authored-By: Claude"', verdict: null},
  {command: "git tag -a v1.0.0 -m v1.0.0", verdict: null},
];

const editCases: Case[] = [
  {
    file_path: "/x/tsconfig.json",
    content: '{"compilerOptions":{"strict":false}}',
    verdict: "deny",
    id: "tsconfig-strict-weakening",
  },
  {
    file_path: "/x/tsconfig.base.json",
    content: '{"compilerOptions":{"skipLibCheck":true}}',
    verdict: "deny",
  },
  {
    file_path: "/x/bar.py",
    content: "x = thing()  # type: ignore",
    verdict: "deny",
    id: "py-type-ignore-blanket",
  },
  // Allowed cases.
  {
    file_path: "/x/bar.py",
    content: "x = thing()  # type: ignore[arg-type]",
    verdict: null,
  },
  {file_path: "/x/tsconfig.json", content: '{"compilerOptions":{"strict":true}}', verdict: null},
  // `@ts-ignore` is eslint's job now — the hook must not fire on it.
  {file_path: "/x/foo.ts", new_string: "// @ts-ignore\nconst a = bad();", verdict: null},
];

let pass = 0;
const fail: string[] = [];

const checkRegistry = (
  label: string,
  rules: readonly Rule[],
  cases: Case[],
): void => {
  for (const c of cases) {
    const {verdict, id, ...input} = c;
    const got = evaluate(rules, input);
    const gotVerdict = got?.verdict ?? null;
    try {
      assert.equal(gotVerdict, verdict, `verdict for ${label}: ${JSON.stringify(input)}`);
      if (id) assert.equal(got?.id, id, `rule id for ${label}: ${JSON.stringify(input)}`);
      pass++;
    } catch (err) {
      fail.push(err instanceof Error ? err.message : String(err));
    }
  }
};

checkRegistry("bash", BASH_RULES, bashCases);
checkRegistry("edit", EDIT_RULES, editCases);

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
    // The compiler now proves the output SHAPE (contract.mts); this only smoke-
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
    res: run("guard-bash.mts", {tool_name: "Bash", tool_input: {command: "git status"}}),
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

if (fail.length) {
  console.error(`✖ hooks tests: ${fail.length} failed\n  ` + fail.join("\n  "));
  process.exit(1);
}
console.log(`hooks tests OK — ${pass} assertions passed`);
