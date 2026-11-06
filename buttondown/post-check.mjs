/**
 * The copy gate for one newsletter post, behind `buttondown check
 * <file.md>`; `draft` runs it before it uploads anything. A problem fails
 * the post, a warning is printed and doesn't. The post is read by
 * `readPost`, the parser `draft` uses too. The checks and their thresholds
 * are in `docs/buttondown.md`, *What `check` refuses in a post*.
 */
import {execFile} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {
  findPersonalData, personalDataSettings,
} from "../bin/check-personal-data.mjs";
import {
  CASOMO_CONFIG_KEYS, loadCasomoConfig, loadConfig,
} from "../bin/casomo-config.mjs";
import {
  DEFAULT_MAX_GRADE, DEFAULT_WORD_SUBS, scoreText,
} from "../readability/index.mjs";
import {
  paragraphsOf, proseOf, withoutCode,
} from "../readability/markdown.mjs";
import {readerParts, readerText, readPost} from "./post.mjs";

/** The banned-word list: `words` are checked, `inContext` words are wrong
 *  in one sense only, which a word match can't tell, so they are not. */
export const BANNED = JSON.parse(readFileSync(
  new URL("banned-words.json", import.meta.url), "utf8"));

/** An em dash, as the character or as any HTML entity for it. */
const EM_DASH = /—|&mdash;|&#8212;|&#x2014;/i;

/** The names cspell looks for its config under, in its own order. */
const CSPELL_CONFIGS = [
  ".cspell.json", "cspell.json", ".cSpell.json", "cSpell.json",
  "cspell.config.json", "cspell.config.mjs", "cspell.config.js",
  "cspell.config.yaml", "cspell.yaml",
];
/** cspell's exit status when it found unknown words, and nothing worse. */
const CSPELL_FOUND = 1;

/** A link that is gone for good: the page was removed, not mislaid. */
const NOT_FOUND = 404;
const GONE_FOR_GOOD = 410;
const GONE = new Set([NOT_FOUND, GONE_FOR_GOOD]);
/** A status from the publisher's side, which may clear on a retry. */
const SERVER_ERROR = 500;
/** A refusal from the publisher (403, 429), which says nothing either way
 *  about the page. */
const CLIENT_ERROR = 400;
/** How long one fetch of a link may take. Proposed here; no external
 *  source. */
const LINK_TIMEOUT_MS = 10_000;

/**
 * Every problem and warning for the post at `file`, checked as the repo
 * at `root` configures it: `root` picks whose word lists, ceiling and
 * personal-data rules apply, so it has no default. `fetchImpl` is the link
 * fetcher, so a test runs without the network.
 */
export async function checkPost(file, {root, fetchImpl = fetch}) {
  if (!root) throw new Error("checkPost needs the repo root to check against");
  const post = await readPost(file);
  const config = await loadConfig("readability.config.mjs", root);
  return merge([
    readabilityProblems(post, {
      maxGrade: config.maxGrade ?? DEFAULT_MAX_GRADE,
      wordSubs: config.wordSubs ?? DEFAULT_WORD_SUBS,
    }),
    emDashProblems(post),
    bannedProblems(post),
    // All of `raw`, front matter too, as an address could sit anywhere.
    await personalDataProblems(post.raw, root),
    await spellingProblems(readerText(post), root),
    await linkProblems(post, fetchImpl),
  ]);
}

/** Every http(s) URL the post links to or loads, once each; an example in
 *  code is not a link. */
export function linksOf(markdown) {
  const text = withoutCode(markdown);
  const found = [
    ...text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g),
    ...text.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g),
    ...text.matchAll(/<(https?:\/\/[^>\s]+)>/g),
  ].map((m) => m[1]);
  return [...new Set(found)];
}

/** Each banned word or phrase the prose uses, once. A typographic
 *  apostrophe matches a straight one. */
export function bannedIn(text, words = BANNED.words) {
  const plain = text.replace(/’/g, "'");
  return words.filter((w) => new RegExp(
    `(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "i",
  ).test(plain));
}

const merge = (parts) => ({
  problems: parts.flatMap((p) => p.problems ?? []),
  warnings: parts.flatMap((p) => p.warnings ?? []),
});

function readabilityProblems(post, {maxGrade, wordSubs}) {
  const result = scoreText(proseOf(paragraphsOf(post.body)), wordSubs);
  if (result.unscored) {
    return {warnings: [`readability: ${result.wordCount} words, too few to score`]};
  }
  return result.consensusGrade > maxGrade
    ? {problems: [`readability: grade ${result.consensusGrade}, above ${maxGrade}`]}
    : {};
}

/** Checked on the text as written, code aside, so an entity counts too. */
function emDashProblems(post) {
  const where = readerParts(post)
    .filter(([, text]) => EM_DASH.test(withoutCode(text)))
    .map(([name]) => name);
  return where.length
    ? {problems: [`em dash in the ${where.join(", ")}: use a full stop, colon, `
      + "semicolon, comma or brackets"]}
    : {};
}

function bannedProblems(post) {
  const used = bannedIn(proseOf(readerText(post)));
  return used.length ? {problems: [`banned words: ${used.join(", ")}`]} : {};
}

async function personalDataProblems(raw, root) {
  const config = await loadCasomoConfig(CASOMO_CONFIG_KEYS.personalData, root);
  const {rules, names, denylist, hasDenylist} = personalDataSettings(config, root);
  const hits = findPersonalData(raw, rules, names);
  return {
    problems: hits.map((h) => `personal data, line ${h.line}: ${h.rule}`),
    warnings: hasDenylist ? []
      : [`personal data: no ${path.relative(root, denylist)}; name checking off`],
  };
}

/** Unknown words the repo's cspell reports, read from stdin as markdown.
 *  Any failure of cspell itself is a problem: a check that didn't run must
 *  not read as clean. */
async function spellingProblems(raw, root) {
  const bin = path.join(root, "node_modules", ".bin", "cspell");
  if (!existsSync(bin)) {
    return {problems: ["spelling: cspell is not installed in this repo"]};
  }
  const config = spellConfig(root);
  if (config.missing) {
    return {problems: [`spelling: the spell script names ${config.missing}, `
      + "which doesn't exist"]};
  }
  const run = await outputOf(bin, [
    "lint", "--no-progress", "--no-summary", "--no-color",
    ...(config.file ? ["--config", config.file] : []),
    "--language-id", "markdown", "stdin",
  ], {cwd: root, input: raw});
  const unknown = [...run.stdout.matchAll(/Unknown word \(([^)]+)\)/g)]
    .map((m) => m[1]);
  if (run.code === 0) return {};
  if (run.code === CSPELL_FOUND && unknown.length) {
    return {problems: [`spelling: ${[...new Set(unknown)].join(", ")}`]};
  }
  const why = (run.stderr.trim().split("\n")[0] || run.stdout.trim()) || "no output";
  return {problems: [`spelling: cspell failed (${run.code}): ${why}`]};
}

/** The cspell config the repo's own `spell` script names, so a post is
 *  checked against the words its pages are; else the first file cspell's
 *  own search would find. Read from stdin, cspell searches for neither. */
function spellConfig(root) {
  const pkg = path.join(root, "package.json");
  const script = existsSync(pkg)
    ? JSON.parse(readFileSync(pkg, "utf8")).scripts?.spell ?? "" : "";
  const named = script.match(/(?:^|\s)(?:-c|--config)[\s=]+(\S+)/)?.[1];
  if (named) {
    const file = path.join(root, named.replace(/^["']|["']$/g, ""));
    return existsSync(file) ? {file} : {missing: named};
  }
  return {file: CSPELL_CONFIGS.map((f) => path.join(root, f))
    .find((f) => existsSync(f))};
}

/** What a command prints and how it exits, given `input` on stdin. A spawn
 *  failure comes back as a non-numeric code, never as a throw. */
const outputOf = (bin, args, {cwd, input}) => new Promise((resolve) => {
  const child = execFile(bin, args, {cwd}, (error, stdout, stderr) => resolve({
    code: error ? error.code ?? "error" : 0, stdout: String(stdout ?? ""),
    stderr: String(stderr ?? ""),
  }));
  child.stdin.on("error", () => {});
  child.stdin.end(input);
});

/** Every link in the body, and the share image, fetched. When every one
 *  failed for a reason a retry might clear, the check didn't run, which is
 *  said once rather than per link. */
async function linkProblems(post, fetchImpl) {
  const urls = [...new Set([
    ...linksOf(post.body),
    ...(/^https?:\/\//.test(post.fields.image ?? "") ? [post.fields.image] : []),
  ])];
  const outcomes = await Promise.all(urls.map((url) => linkOutcome(url, fetchImpl)));
  if (urls.length && outcomes.every((o) => o.transient)) {
    return {warnings: [`links: none of ${urls.length} could be checked (network?)`]};
  }
  return merge(outcomes);
}

async function linkOutcome(url, fetchImpl) {
  let r = await fetchStatus(url, fetchImpl);
  if (transient(r)) r = await fetchStatus(url, fetchImpl);
  if (GONE.has(r.status)) return {problems: [`link ${r.status}: ${url}`]};
  if (transient(r)) {
    return {transient: true,
      warnings: [`link ${r.status ?? r.error} after a retry: ${url}`]};
  }
  return r.status >= CLIENT_ERROR ? {warnings: [`link ${r.status}: ${url}`]} : {};
}

const transient = (r) => r.error || r.status >= SERVER_ERROR;

/** One link's status, or the error that stopped it. */
async function fetchStatus(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, {
      redirect: "follow", signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return {status: res.status};
  } catch (error) {
    return {error: error?.name ?? String(error)};
  }
}
