#!/usr/bin/env node
// Tests for the gate-composition checker. `evaluate` is pure over a synthetic
// package.json, so these assert the RULES — which a type cannot check — rather
// than any real repo's current state, which would date the moment it changed.
import {strict as assert} from "node:assert";
import {evaluate, isGate, referencedGates, REQUIRED} from "./check-gates.mjs";

// A package that satisfies every required gate, as the baseline to perturb.
const chain = (gates) => gates.map((g) => `npm run ${g}`).join(" && ");
const healthy = () => ({
  scripts: {
    ...Object.fromEntries(REQUIRED.map((g) => [g, `run-${g}`])),
    check: chain(REQUIRED),
  },
});

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

it("a fully-wired repo has nothing to report", () => {
  const r = evaluate(healthy());
  assert.deepEqual(r.live, []);
  assert.deepEqual(r.unreasoned, []);
  assert.deepEqual(r.stale, []);
});

it("a required gate that is not defined fails", () => {
  const pkg = healthy();
  delete pkg.scripts.knip;
  pkg.scripts.check = chain(REQUIRED.filter((g) => g !== "knip"));
  assert.equal(evaluate(pkg).live.filter(([g]) => g === "knip").length, 1);
});

it("a required gate defined but not run by check fails", () => {
  const pkg = healthy();
  pkg.scripts.check = chain(REQUIRED.filter((g) => g !== "jscpd"));
  const [gate, reason] = evaluate(pkg).live.find(([g]) => g === "jscpd");
  assert.equal(gate, "jscpd");
  assert.match(reason, /never runs it/);
});

it("an optional gate defined but not run is a dead gate", () => {
  const pkg = healthy();
  pkg.scripts["check:readability"] = "readability";
  assert.equal(
    evaluate(pkg).live.filter(([g]) => g === "check:readability").length,
    1,
  );
});

it("a reasoned exception excuses the failure and is reported", () => {
  const pkg = healthy();
  delete pkg.scripts.test;
  pkg.scripts.check = chain(REQUIRED.filter((g) => g !== "test"));
  pkg.casomo = {gates: {test: "content site — no suite yet"}};
  const r = evaluate(pkg);
  assert.deepEqual(r.live, []);
  assert.deepEqual(r.excused, [["test", "content site — no suite yet"]]);
});

it("an exception with a blank reason is itself a failure", () => {
  const pkg = healthy();
  delete pkg.scripts.spell;
  pkg.scripts.check = chain(REQUIRED.filter((g) => g !== "spell"));
  pkg.casomo = {gates: {spell: "   "}};
  assert.deepEqual(evaluate(pkg).unreasoned, ["spell"]);
});

it("an exception whose failure has gone away is stale", () => {
  const pkg = healthy();
  pkg.casomo = {gates: {knip: "was flaky once"}};
  assert.deepEqual(evaluate(pkg).stale, ["knip"]);
});

it("non-gate scripts are ignored without a denylist", () => {
  const pkg = healthy();
  Object.assign(pkg.scripts, {
    dev: "next dev",
    start: "next start",
    clean: "rm -rf .next",
    "lint:fix": "eslint --fix",
    "test:watch": "vitest",
    "build:clean": "npm run clean && npm run build",
    indexnow: "node scripts/indexnow-submit.mjs",
    readability: "readability",
    prepare: "husky",
  });
  assert.deepEqual(evaluate(pkg).live, []);
});

it("a whole segment is matched, so lint:md never reads as lint", () => {
  assert.deepEqual([...referencedGates("npm run lint:md")], ["lint:md"]);
  const both = referencedGates("npm run lint && npm run lint:md");
  assert.ok(both.has("lint") && both.has("lint:md"));
});

it("segments that are not `npm run` register no gate", () => {
  assert.deepEqual([...referencedGates("tsc --noEmit && node hooks/test.mts")], []);
});

it("gate membership is exact or check:-prefixed", () => {
  assert.ok(isGate("knip") && isGate("check:anything"));
  assert.ok(!isGate("lint:fix") && !isGate("dev") && !isGate("readability"));
});

if (fail.length) {
  console.error(`✖ check-gates tests: ${fail.length} failed\n  ` + fail.join("\n  "));
  process.exit(1);
}
console.log(`check-gates tests OK — ${pass} assertions passed`);
