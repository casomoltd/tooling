#!/usr/bin/env node
// Assert that a repo's `check` script is COMPOSED correctly, before it runs.
//
// Each repo hand-writes `check` as an ordered `&&` chain, which is worth
// keeping: the repos are heterogeneous and some chains carry a real ordering
// constraint (build must precede any assertion that reads build output). What
// is not worth keeping is that chain being unverified — a gate can be dropped,
// or defined and never wired in, and nothing says a word.
//
// So this does not orchestrate the gates; it checks the composition:
//   1. every REQUIRED gate is defined and actually run by `check`
//   2. no gate-shaped script is defined but left unreferenced (a dead gate),
//      other than a pre-push gate, which the hook runs instead
//   3. no exception outlives the problem it was written for
//   4. no pre-push gate is run by `check`, which every commit pays for
//
// A repo opts out by declaring a reason in its own package.json. A blank
// reason fails, so an opt-out can never be silent:
//
//   "casomo": { "gates": { "test": "content site — no suite yet" } }
//
// Declared exceptions are printed on every run: excusing a gap must not be the
// same thing as hiding it.
import {readFileSync, realpathSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

/** Gates every repo must define and run, absent a declared exception. */
export const REQUIRED = [
  "lint",
  "typecheck",
  "test",
  "knip",
  "jscpd",
  "lint:md",
  "spell",
  "build",
];

/** Gate-shaped but not mandatory: still dead if defined and never run. */
export const OPTIONAL = ["check:readability"];

/** Gates the pre-push hook runs after `check`, never `check` itself: they
 * start a server against the build, which a commit should not pay for.
 * bin/pre-push.sh runs each by name, so the two lists must match. */
export const PRE_PUSH = ["check:routes"];

/** A script is a gate only by exact membership or the `check:` prefix — never
 * by heuristic, so `dev`, `start`, `clean`, `lint:fix`, `test:watch`,
 * `build:clean` and `indexnow` need no denylist to be ignored. */
export const isGate = (name) =>
  REQUIRED.includes(name) || OPTIONAL.includes(name) || name.startsWith("check:");

/** Gates `check` actually invokes. Segments are matched whole so that a repo
 * running only `lint:md` never reads as also running `lint`. */
export const referencedGates = (check) =>
  new Set(
    String(check ?? "")
      .split("&&")
      .map((segment) => segment.trim().match(/^npm run ([\w:.-]+)/)?.[1])
      .filter(Boolean),
  );

/** Each required gate that is not defined, or defined but never run. */
const requiredFailures = (scripts, run) =>
  REQUIRED.flatMap((gate) => {
    if (!(gate in scripts)) return [[gate, `required gate is not defined`]];
    if (!run.has(gate)) {
      return [[gate, `required gate is defined but \`check\` never runs it`]];
    }
    return [];
  });

/** Each other gate-shaped script that `check` never runs. `check` itself is
 * the chain, not a step within it, and the hook runs a pre-push gate. */
const deadGates = (scripts, run) =>
  Object.keys(scripts)
    .filter((n) => isGate(n) && n !== "check" && !REQUIRED.includes(n))
    .filter((gate) => !PRE_PUSH.includes(gate))
    .filter((gate) => !run.has(gate))
    .map((gate) => [gate, `defined but \`check\` never runs it — a dead gate`]);

/** Each pre-push gate that `check` runs, so every commit starts a server. */
const prePushInCheck = (run) =>
  PRE_PUSH.filter((gate) => run.has(gate)).map((gate) => [
    gate,
    `a pre-push gate: \`check\` runs on every commit`,
  ]);

/** Sort the failures by their exception: none, a blank reason, or a reason. */
const byException = (failures, exceptions) => {
  const sorted = {live: [], excused: [], unreasoned: []};
  for (const [gate, reason] of failures) {
    if (!(gate in exceptions)) sorted.live.push([gate, reason]);
    else if (!String(exceptions[gate] ?? "").trim()) sorted.unreasoned.push(gate);
    else sorted.excused.push([gate, exceptions[gate]]);
  }
  return sorted;
};

export const evaluate = (pkg) => {
  const scripts = pkg.scripts ?? {};
  const exceptions = pkg.casomo?.gates ?? {};
  const run = referencedGates(scripts.check);
  const failures = [
    ...requiredFailures(scripts, run),
    ...deadGates(scripts, run),
    ...prePushInCheck(run),
  ];
  // An exception whose failure has gone away is the same rot in reverse.
  const stale = Object.keys(exceptions).filter(
    (gate) => !failures.some(([g]) => g === gate),
  );
  return {...byException(failures, exceptions), stale};
};

const main = () => {
  const dir = process.cwd();
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const {live, excused, unreasoned, stale} = evaluate(pkg);

  for (const [gate, reason] of excused) {
    console.log(`check-gates: skipping \`${gate}\` — ${reason}`);
  }

  const problems = [
    ...live.map(([gate, reason]) => `${gate}: ${reason}`),
    ...unreasoned.map(
      (gate) => `${gate}: exception declared with no reason — say why, or fix it`,
    ),
    ...stale.map(
      (gate) => `${gate}: exception is no longer needed — the gate passes, drop it`,
    ),
  ];

  if (problems.length) {
    console.error(
      `✖ check-gates: ${problems.length} problem(s)\n  ` +
        problems.join("\n  ") +
        `\n\nDeclare an exception in package.json to opt out, with a reason:\n` +
        `  "casomo": { "gates": { "<gate>": "why this repo does not run it" } }`,
    );
    process.exit(1);
  }

  console.log(
    `check-gates OK — ${REQUIRED.length} required gates` +
      (excused.length ? `, ${excused.length} excused` : ""),
  );
};

/** True only when this file is the entry point. npm installs a bin as a symlink,
 * so `process.argv[1]` is the link while `import.meta.url` is the target it
 * resolves to — comparing them raw silently skips `main`, and the gate then
 * "passes" in every consumer without ever running. Resolve before comparing. */
const isEntryPoint = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
};

if (isEntryPoint()) main();
