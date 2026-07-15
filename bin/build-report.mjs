#!/usr/bin/env node

/**
 * Compile a Typst client report to PDF with the Casomo house template.
 *
 * Usage:
 *   build-report <report.typ> [--out <file.pdf>] [--watch] [--open]
 *
 * Arguments:
 *   report.typ  The report source. It imports the house template
 *               (report/casomo-template.typ in this package).
 *
 * Options:
 *   --out, -o <file>  Output PDF path. Default follows the README's report
 *                     output rule: $SCRATCH_DIR/reports/<name>.pdf, or
 *                     <repo-root>/scratch/reports/ when unset (gitignore
 *                     scratch/ in the consumer repo).
 *   --root <dir>      Typst compile root (default: auto-detected, see below)
 *   --watch           Recompile on save (typst watch)
 *   --open            Open the PDF after a successful compile (ignored with
 *                     --watch)
 *
 * Requirements (not npm-managed):
 *   - the `typst` CLI on PATH (https://typst.app)
 *   - the IBM Plex Sans / IBM Plex Mono fonts installed
 */

import {parseArgs} from "node:util";
import {spawnSync} from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {openPath} from "./utils.mjs";

const {values, positionals} = parseArgs({
  options: {
    out: {type: "string", short: "o"},
    root: {type: "string"},
    watch: {type: "boolean", default: false},
    open: {type: "boolean", default: false},
  },
  allowPositionals: true,
});

function fail(message) {
  console.error(`build-report: ${message}`);
  process.exit(1);
}

if (!positionals[0]) {
  fail("usage: build-report <report.typ> [--out <file.pdf>] [--watch] [--open]");
}
const input = path.resolve(positionals[0]);
if (!fs.existsSync(input)) fail(`no such file: ${input}`);
if (path.extname(input) !== ".typ") fail(`expected a .typ source, got: ${input}`);

// Typst refuses to read files outside its --root, and a report imports the
// template as "/node_modules/@casomoltd/tooling/report/casomo-template.typ".
// Prefer the ancestor whose node_modules actually holds this package — in a
// hoisted/workspace layout that is higher than the report's own package.json —
// falling back to the nearest package.json/.git ancestor (this repo itself,
// where the example imports the template relative). No marker at all is an
// error: compiling on with a wrong root would only surface later as a
// confusing Typst import failure.
function findRoot(from) {
  const packageDir = path.join("node_modules", "@casomoltd", "tooling", "report");
  let marker = null;
  let dir = path.dirname(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, packageDir))) return dir;
    if (
      marker === null &&
      (fs.existsSync(path.join(dir, "package.json")) ||
        fs.existsSync(path.join(dir, ".git")))
    ) {
      marker = dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (marker) return marker;
  fail("no repo root found above the input (package.json/.git) — pass --root <dir>");
}
const root = values.root ? path.resolve(values.root) : findRoot(input);

// typst is an external native binary (like puppeteer for screenshot, it is
// deliberately not an npm dependency). One probe does double duty: ENOENT
// means typst is missing; otherwise the output feeds the font check. Missing
// fonts don't fail a Typst compile — it silently falls back and the PDF comes
// out off-brand — so warn loud up front.
const fonts = spawnSync("typst", ["fonts"], {encoding: "utf8"});
if (fonts.error) {
  fail(
    "the `typst` CLI is not on PATH — install it first " +
      "(https://typst.app, e.g. `snap install typst` or `cargo install typst-cli`).",
  );
}
if (fonts.status === 0) {
  const families = new Set(fonts.stdout.split(/\r?\n/));
  // Keep in sync with the faces report/tokens.typ names.
  for (const family of ["IBM Plex Sans", "IBM Plex Mono"]) {
    if (!families.has(family)) {
      console.warn(
        `build-report: font "${family}" not found — the PDF will use a ` +
          "fallback font. Install IBM Plex: https://github.com/IBM/plex",
      );
    }
  }
} else {
  console.warn("build-report: could not verify fonts (`typst fonts` failed)");
}

// A compiled PDF is a throwaway build artefact, not a source — default it to
// the shared scratch pool, same resolution order as the agent reports (README
// "Report output & SCRATCH_DIR"): $SCRATCH_DIR/reports/, else a repo-local
// scratch/reports/. --out opts out for deliverables a repo serves.
const output = values.out
  ? path.resolve(values.out)
  : path.join(
      path.resolve(process.env.SCRATCH_DIR || path.join(root, "scratch")),
      "reports",
      path.basename(input, ".typ") + ".pdf",
    );
fs.mkdirSync(path.dirname(output), {recursive: true});

const mode = values.watch ? "watch" : "compile";
const result = spawnSync("typst", [mode, "--root", root, input, output], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

// typst watch narrates its own recompiles and only returns on interrupt, so
// the post-compile tail is for single compiles only.
if (!values.watch) {
  console.log(`Report compiled: ${output}`);
  if (values.open) openPath(output);
}
