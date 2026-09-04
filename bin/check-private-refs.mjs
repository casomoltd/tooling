#!/usr/bin/env node
/**
 * Fail a PUBLIC repo that names something only its authors can reach.
 *
 * A private tracker link, an internal hostname, the name of a repo
 * nobody outside can clone — each is a disclosure, and none of them is
 * a syntax error. Existing cover is guidance and a human reviewer, both
 * fallible, for a mistake that is unrecoverable the moment it is
 * pushed: the commit is public even if the file is deleted afterwards.
 *
 * The failure this exists for is not carelessness. It is a CORRECT rule
 * followed into the wrong repo — "link the tracking task" is good
 * advice, and doing it in a published package is how the reference gets
 * out. So the check runs on the repo's visibility, not on the author's
 * intent.
 *
 * VISIBILITY FIRST, always. A private repo SHOULD carry tracker links;
 * flagging them there would train everyone to ignore this.
 *
 * Deliberately configurable rather than opinionated. This file ships in
 * a public package, so it cannot itself name anybody's private repos,
 * boards or hosts — that would be the disclosure it exists to prevent.
 * The defaults cover hosted trackers that are private by default; a
 * consuming repo adds its own names in `check-private-refs.config.mjs`:
 *
 *   export default {
 *     visibility: 'public',        // optional; skips the gh lookup
 *     forbidden: [                 // strings or RegExp
 *       {pattern: /internal\.example\.net/, why: 'internal hostname'},
 *     ],
 *     allow: [/CHANGELOG\.md$/],   // paths exempted, with care
 *   };
 */

import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {loadConfig} from "./utils.mjs";

/**
 * Hosted trackers whose links are private by default.
 *
 * Generic on purpose: every one of these is a product many teams use,
 * so naming them discloses nothing about who is running this check.
 */
const DEFAULT_FORBIDDEN = [
  {pattern: /\bnotion\.so\//i, why: "Notion link"},
  {pattern: /\bapp\.notion\.com\//i, why: "Notion link"},
  {pattern: /\blinear\.app\/[\w-]+\/issue\//i, why: "Linear issue link"},
  {pattern: /\b[\w-]+\.atlassian\.net\//i, why: "Jira/Confluence link"},
  {pattern: /\bapp\.shortcut\.com\//i, why: "Shortcut story link"},
  {pattern: /\bapp\.asana\.com\//i, why: "Asana task link"},
  {pattern: /\btrello\.com\/c\//i, why: "Trello card link"},
  {pattern: /\bheight\.app\//i, why: "Height task link"},
];

/** Text files only. A match inside a binary is noise, not a leak. */
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".svg",
  ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tgz", ".mp4", ".webm", ".lock",
]);

function repoVisibility(configured) {
  if (configured) return configured;
  try {
    const out = execFileSync(
      "gh", ["repo", "view", "--json", "visibility", "-q", ".visibility"],
      {encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"]},
    );
    return out.trim().toLowerCase();
  } catch {
    return null;
  }
}

function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], {encoding: "utf-8"});
  return out.split("\n").filter(Boolean);
}

function toMatchers(entries) {
  return entries.map((e) => {
    if (typeof e === "string") {
      return {pattern: new RegExp(e), why: e};
    }
    if (e instanceof RegExp) return {pattern: e, why: String(e)};
    return {
      pattern: e.pattern instanceof RegExp
        ? e.pattern
        : new RegExp(e.pattern),
      why: e.why ?? String(e.pattern),
    };
  });
}

async function main() {
  const mod = await loadConfig("check-private-refs.config.mjs");
  // `loadConfig` returns the MODULE, so the config is its default
  // export. Reading the module object itself silently found no
  // patterns and reported a clean repo.
  const config = mod?.default ?? {};
  const visibility = repoVisibility(config.visibility);

  if (visibility === null) {
    // Not fatal, but never silent. A repo whose visibility we cannot
    // establish has not been checked, and saying "skipped" is the
    // difference between a gap you know about and one you do not.
    console.warn(
      "check-private-refs: SKIPPED — could not determine repo "
      + "visibility (is `gh` installed and authenticated?). Set "
      + "`visibility` in check-private-refs.config.mjs to be explicit.",
    );
    return;
  }
  if (visibility !== "public") {
    console.log(
      `check-private-refs: repo is ${visibility} — private references `
      + "are expected here, nothing to check",
    );
    return;
  }

  const matchers = toMatchers([
    ...DEFAULT_FORBIDDEN,
    ...(config.forbidden ?? []),
  ]);
  const allow = (config.allow ?? []).map((a) =>
    a instanceof RegExp ? a : new RegExp(a));

  const findings = [];
  for (const file of trackedFiles()) {
    if (SKIP_EXT.has(path.extname(file).toLowerCase())) continue;
    if (allow.some((a) => a.test(file))) continue;
    let lines;
    try {
      lines = fs.readFileSync(file, "utf-8").split("\n");
    } catch {
      continue;
    }
    lines.forEach((line, i) => {
      for (const {pattern, why} of matchers) {
        if (pattern.test(line)) {
          findings.push({
            file, line: i + 1, why, text: line.trim().slice(0, 120),
          });
        }
      }
    });
  }

  if (findings.length === 0) {
    console.log(
      `check-private-refs OK — public repo, ${matchers.length} patterns, `
      + "0 private references",
    );
    return;
  }

  console.error(
    `\ncheck-private-refs: ${findings.length} private reference(s) in a `
    + "PUBLIC repo:\n",
  );
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.why}\n    ${f.text}`);
  }
  console.error(
    "\nA public repo must name only what its readers can open. Where a "
    + "tracker link is what you wanted, name the retirement CONDITION "
    + "instead, or link an issue on this repo.",
  );
  process.exit(1);
}

main();
