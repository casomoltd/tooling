/**
 * The post copy gate's test harness, shared by its test files: a runner
 * that counts failures, a repo in a temp directory with a stand-in cspell
 * that records how it was called, and a stubbed fetch, so nothing reaches
 * the network.
 */
import {chmodSync, mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {checkPost} from "./post-check.mjs";

/** Plain sentences, enough of them for the formulas to score. */
export const PLAIN = Array.from({length: 30},
  () => "The pay rise is small. Tax takes part of it.").join(" ");

/** The stand-in cspell's mode: its owner may run it. */
const EXECUTABLE = 0o755;

let failures = 0;

export async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}\n     ${error.message}`);
  }
}

/**
 * A repo whose stand-in cspell reports each word in `unknown`, or exits
 * with `crash` and no output. It writes its arguments to `cspell.args`.
 */
export function repo({unknown = [], crash, config = {}, denylist = "", pkg} = {}) {
  const root = mkdtempSync(join(tmpdir(), "post-check-"));
  const bin = join(root, "node_modules", ".bin");
  mkdirSync(bin, {recursive: true});
  const lines = unknown.map((w) => `echo "stdin:1:1 - Unknown word (${w})"`);
  const status = crash ?? (unknown.length ? 1 : 0);
  writeFileSync(join(bin, "cspell"), "#!/bin/sh\n"
    + `echo "$@" > "${join(root, "cspell.args")}"\n`
    + `cat > "${join(root, "cspell.stdin")}"\n`
    + `${lines.join("\n")}\nexit ${status}\n`);
  chmodSync(join(bin, "cspell"), EXECUTABLE);
  writeFileSync(join(root, "casomo.config.mjs"),
    `export default ${JSON.stringify(config)};\n`);
  if (denylist !== null) writeFileSync(join(root, ".personal-data-denylist"), denylist);
  if (pkg) writeFileSync(join(root, "package.json"), JSON.stringify(pkg));
  return root;
}

/** A fetch that answers each URL with the status `statuses` gives it, or
 *  `fallback`; a status of "throw" rejects, as a timeout does. A URL in
 *  `pages` answers with that page: its `status` (200 if none), its `html`,
 *  or a `text` of another `type`, and `redirectedTo`, the URL it ended up
 *  at. */
export function stubFetch(statuses = {}, fallback = 200, pages = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const page = pages[url];
    if (page) return pageResponse(page);
    const status = statuses[url] ?? fallback;
    if (status === "throw") throw Object.assign(new Error("t"), {name: "TimeoutError"});
    return new Response(null, {status});
  };
  return {impl, calls};
}

export const check = (root, text, fetcher = stubFetch()) =>
  checkPost(post(root, text), {root, fetchImpl: fetcher.impl});

/** Ends a test file: exits non-zero when any test in it failed. */
export function finish() {
  if (failures) {
    console.error(`\n${failures} failing`);
    process.exit(1);
  }
}

function post(root, text) {
  const file = join(root, "post.md");
  writeFileSync(file, text);
  return file;
}

function pageResponse({status = 200, html, type = "text/html; charset=utf-8",
  text, redirectedTo}) {
  const res = new Response(html ?? text, {status, headers: {"content-type": type}});
  // A Response built by hand has no URL and was never redirected; fetch
  // sets both.
  if (redirectedTo) {
    Object.defineProperties(res, {
      url: {value: redirectedTo}, redirected: {value: true},
    });
  }
  return res;
}
