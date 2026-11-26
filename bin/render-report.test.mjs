#!/usr/bin/env node
// render-report's two tests. It renders with no `node_modules` in reach,
// which is how an agent runs it from a plugin's checkout. And its copy of
// `marked` is the installed one, byte for byte, so a dependency update
// fails here until the copy is refreshed.
import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {cp, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COPY = "bin/vendor/marked.mjs";
const INSTALLED = "node_modules/marked/lib/marked.esm.js";

const read = (file) => readFile(path.join(REPO, file));
assert.ok(
  (await read(COPY)).equals(await read(INSTALLED)),
  `${COPY} is not the installed marked: copy ${INSTALLED} over it`,
);

const dir = await mkdtemp(path.join(os.tmpdir(), "render-report-"));
try {
  // The script and what it reads, with no `node_modules` above them.
  const parts = [
    "bin/render-report.mjs", "bin/utils.mjs", "bin/vendor", "styles",
  ];
  for (const part of parts) {
    await cp(path.join(REPO, part), path.join(dir, part), {recursive: true});
  }
  const report = path.join(dir, "report.md");
  await writeFile(report, "# A report\n\n```mermaid\nflowchart LR\n  a --> b\n```\n");
  const run = spawnSync(
    process.execPath,
    [path.join(dir, "bin/render-report.mjs"), report, "--no-open"],
    // `NODE_PATH` is a second place Node looks for a package.
    {cwd: dir, encoding: "utf8", env: {...process.env, NODE_PATH: ""}},
  );
  assert.equal(run.status, 0, run.stderr);
  const html = await readFile(path.join(dir, "report.html"), "utf8");
  assert.match(html, /<h1[^>]*>A report<\/h1>/);
  assert.match(html, /<pre class="mermaid">/);
} finally {
  await rm(dir, {recursive: true, force: true});
}

console.log("render-report: ok");
