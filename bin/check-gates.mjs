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
//   2. no gate-shaped script is defined but left unreferenced (a dead gate)
//   3. no exception outlives the problem it was written for
//
// A repo opts out by declaring a reason in its own package.json. A blank
// reason fails, so an opt-out can never be silent:
//
//   "casomo": { "gates": { "test": "content site — no suite yet" } }
//
// Declared exceptions are printed on every run: excusing a gap must not be the
// same thing as hiding it.
import {readFileSync} from "node:fs";
import {join} from "node:path";

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

export const evaluate = (pkg) => {
  const scripts = pkg.scripts ?? {};
  const exceptions = pkg.casomo?.gates ?? {};
  const run = referencedGates(scripts.check);

  // `check` itself is the chain, not a step within it.
  const defined = Object.keys(scripts).filter((n) => isGate(n) && n !== "check");

  const failures = [];
  for (const gate of REQUIRED) {
    if (!(gate in scripts)) failures.push([gate, `required gate is not defined`]);
    else if (!run.has(gate))
      failures.push([gate, `required gate is defined but \`check\` never runs it`]);
  }
  for (const gate of defined) {
    if (run.has(gate)) continue;
    if (failures.some(([g]) => g === gate)) continue; // already reported above
    failures.push([gate, `defined but \`check\` never runs it — a dead gate`]);
  }

  const excused = [];
  const unreasoned = [];
  const live = [];
  for (const [gate, reason] of failures) {
    if (!(gate in exceptions)) {
      live.push([gate, reason]);
    } else if (!String(exceptions[gate] ?? "").trim()) {
      unreasoned.push(gate);
    } else {
      excused.push([gate, exceptions[gate]]);
    }
  }

  // An exception whose failure has gone away is the same rot in reverse.
  const stale = Object.keys(exceptions).filter(
    (gate) => !failures.some(([g]) => g === gate),
  );

  return {live, excused, unreasoned, stale};
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

if (import.meta.url === `file://${process.argv[1]}`) main();
