#!/usr/bin/env node
/**
 * Refuse to let a person's details reach a commit.
 *
 * A repo that works from real people's records keeps them in a working
 * directory outside it, and they reach it the moment someone pastes a
 * statement into a fixture or reuses a real figure as a "specimen". This
 * finds what has a shape:
 *
 * - **Emails, National Insurance numbers, UK mobile numbers and dates of
 *   birth** are detectable by shape, and these rules find them.
 * - **Names are not.** No pattern separates a person from a cited author, so
 *   names come from a local denylist that is itself never committed: a file
 *   listing the people would be the leak it exists to prevent. Without the
 *   file the other rules still run, and the summary says name checking is off.
 *
 * Deliberately configurable, because this file ships in a public package and
 * cannot name anybody's domains or reference formats. A consuming repo adds
 * its own under `personalData` in its `casomo.config.mjs`:
 *
 *   export default {
 *     personalData: {
 *       allowEmail: [/@example-org\.com$/i], // addresses that are not people
 *       rules: [                             // repo-specific identifiers
 *         {name: "case reference", re: /\bCASE-\d{4,}\b/g,
 *          allow: (m) => m === "CASE-0000"},
 *       ],
 *       denylist: ".personal-data-denylist", // the default; gitignore it
 *       allow: [/\.test\.mjs$/],             // paths exempted, with care
 *     },
 *   };
 *
 * Usage:
 *   check-personal-data            # tracked and untracked-but-not-ignored
 *   check-personal-data --staged   # staged only
 */
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync, realpathSync, statSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {CASOMO_CONFIG_KEYS, loadCasomoConfig} from "./utils.mjs";

/** Addresses in every repo's own tooling that name no person. */
const ALLOWED_EMAIL = [
  /@example\.(com|org|net)$/i,
  /@users\.noreply\.github\.com$/i,
];

/* Files whose content looks like data but never describes a person:
 * lockfiles, generated bundles, fonts, images. */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "out"]);
const SKIP_EXTS = new Set([
  "lock", "woff", "woff2", "ttf", "otf", "png", "jpg", "jpeg", "gif", "webp",
  "ico", "pdf", "zip", "map",
]);

function skip(file) {
  if (file.split("/").some((part) => SKIP_DIRS.has(part))) return true;
  if (file.endsWith("package-lock.json")) return true;
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return SKIP_EXTS.has(ext);
}

/** The field names a data shape puts between a label and its value. */
const FIELD_SUFFIX = /(?:value|val|text|node|display|content)$/;

/** A key that names a birth. */
const BIRTH_KEY = /(?:dob|dateofbirth|birthdate|born)$/;

/** The constructor a source file writes a date with. `new Date(1983, 6, 14)`
 *  matches neither the printed nor the ISO rule, and the words before it end
 *  `newdate` rather than a field name, so both halves would be blind at once
 *  without this. */
const DATE_CALL = /(?:new\s*)?date\($/;

/**
 * Whether the words before a date name a birth.
 *
 * A rendered page puts label and value side by side, so the key is last. A
 * data file nests: `{label: "Date of birth", value: {value: "..."}}` gives a
 * lead-in ending `dateofbirthvaluevalue`. The suffixes come off one at a time
 * rather than as a starred alternation, which backtracks super-linearly
 * because `val` is a prefix of `value`; a bounded loop is linear.
 */
function namesABirth(lead) {
  let rest = lead;
  for (let depth = 0; depth < 4; depth += 1) {
    if (BIRTH_KEY.test(rest)) return true;
    const trimmed = rest.replace(FIELD_SUFFIX, "");
    if (trimmed === rest) return false;
    rest = trimmed;
  }
  return BIRTH_KEY.test(rest);
}

const NON_WORD = /[^a-z0-9]/gi;

/** What precedes a date, as a reader sees it: tags dropped, a generous
 *  window, because a label and its value are separated by a cell boundary
 *  and whatever styling that cell carries. */
const leadIn = (before) =>
  before.replace(/<[^<>]*>/g, " ").slice(-120).replace(NON_WORD, "")
    .toLowerCase();

/** A real address ends in a letters-only top-level domain; without this a
 *  package spec such as `postcss@8.4.31` reads as one. */
const TLD = /\.[A-Za-z]{2,}$/;

/** The identity rules every repo gets. */
export function identityRules(allowEmail = []) {
  const allowed = [...ALLOWED_EMAIL, ...allowEmail];
  return [
    {
      name: "email address",
      // Labels joined by dots, not one class containing the dot: letting `.`
      // sit in the class too makes the parts overlap and backtrack.
      re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g,
      allow: (m) => allowed.some((a) => a.test(m)) || !TLD.test(m),
    },
    {
      name: "National Insurance number",
      re: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g,
    },
    {
      name: "UK mobile number",
      re: /\b(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}\b/g,
    },
    {
      name: "date of birth",
      // Every ISO date, then the words before it decide: a bare date is a
      // rule's date far more often than a person's.
      re: /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
      // 1 January is the placeholder a redacted fixture writes; flagging it
      // trains everyone to ignore the check.
      allow: (m) => /[-/]0?1[-/]0?1$/.test(m),
      context: (before) => namesABirth(leadIn(before)),
    },
    {
      name: "date of birth",
      // The printed form, "DD Month YYYY", which the ISO rule cannot see.
      re: /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\b/g,
      allow: (m) => /^0?1\s+January\s/.test(m),
      context: (before) => namesABirth(leadIn(before)),
    },
    {
      name: "date of birth",
      // The constructed form. Month is zero-based, so the placeholder is
      // month 0, day 1. The key is whatever the constant is called.
      re: /\bnew\s+Date\(\s*(?:19|20)\d{2}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)/g,
      allow: (m) => /,\s*0\s*,\s*0?1\s*\)$/.test(m),
      context: (before) => namesABirth(leadIn(before))
        || BIRTH_KEY.test(leadIn(before).replace(DATE_CALL, "")),
    },
  ];
}

/** Every finding in one file's text, against the rules and the names. */
export function findPersonalData(text, rules, names = []) {
  const hits = [];
  const lines = text.split("\n");
  for (const rule of rules) {
    for (const [i, line] of lines.entries()) {
      for (const m of line.matchAll(rule.re)) {
        if (rule.allow?.(m[0])) continue;
        if (rule.context && !rule.context(line.slice(0, m.index))) continue;
        hits.push({line: i + 1, rule: rule.name, text: m[0]});
      }
    }
  }
  for (const name of names) {
    // No `g`: `.test()` on a global regex advances `lastIndex`, and a name
    // on consecutive lines would be reported on every other one.
    const re = new RegExp(
      `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    for (const [i, line] of lines.entries()) {
      if (re.test(line)) {
        hits.push({line: i + 1, rule: "name on the local denylist", text: name});
      }
    }
  }
  return hits;
}

/* Tracked AND untracked-but-not-ignored: the moment this exists for is the
 * first commit of a new directory, and a tracked-only listing is blind to
 * exactly that. Ignored files are left out on purpose; they are the working
 * directory, where a person's data is supposed to live. */
function files(stagedOnly) {
  const args = stagedOnly
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    : ["ls-files", "--cached", "--others", "--exclude-standard"];
  return execFileSync("git", args, {encoding: "utf8"})
    .split("\n").filter((f) => f && !skip(f) && existsSync(f)
      && statSync(f).isFile());
}

function denied(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
}

/** Every finding across the files, and every file that could not be read,
 *  with the reason. `read` is the reader, so an unreadable file can be
 *  tested without making one. */
export function scan(fileList, read, rules, names) {
  const hits = [];
  const unread = [];
  for (const file of fileList) {
    let text;
    try {
      text = read(file);
    } catch (error) {
      unread.push({file, code: error?.code ?? String(error)});
      continue;
    }
    for (const h of findPersonalData(text, rules, names)) hits.push({file, ...h});
  }
  return {hits, unread};
}

async function main() {
  const config = await loadCasomoConfig(CASOMO_CONFIG_KEYS.personalData);
  const denylist = config.denylist ?? ".personal-data-denylist";
  const rules = [...identityRules(config.allowEmail), ...(config.rules ?? [])];
  const names = denied(denylist);
  const allow = (config.allow ?? []).map((a) =>
    a instanceof RegExp ? a : new RegExp(a));

  const {hits, unread} = scan(
    files(process.argv.includes("--staged"))
      .filter((file) => !allow.some((a) => a.test(file))),
    (file) => readFileSync(file, "utf8"), rules, names);

  // A file this could not read is a file it did not check, so the run is
  // incomplete rather than clean, whatever else it found.
  for (const u of unread) console.error(`  ${u.file}: could not be read (${u.code})`);
  if (unread.length && !hits.length) {
    console.error(`\ncheck-personal-data: INCOMPLETE — ${unread.length} file(s) `
      + "were not checked.\n");
    process.exit(1);
  }

  if (hits.length) {
    console.error("\nPersonal data must not be committed.\n");
    for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.rule}: ${h.text}`);
    console.error(
      `\n${hits.length} finding(s). Move the data to a working directory `
      + "outside every repository, or replace it with values that could not "
      + "be anyone's.\n");
    process.exit(1);
  }

  console.log(
    "check-personal-data: clean"
    + (names.length ? ` (${names.length} name(s) on the local denylist)`
      : ` (no ${denylist}; name checking off)`)
  );
}

/** True only when this file is the entry point. npm installs a bin as a
 *  symlink, so compare the resolved path, or `main` never runs in a consumer. */
const isEntryPoint = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
};

if (isEntryPoint()) main();
