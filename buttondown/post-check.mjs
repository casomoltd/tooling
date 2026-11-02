/**
 * The copy gate for one newsletter post, behind `buttondown check
 * <file.md>`; `draft` runs it before it uploads anything. A problem fails
 * the post, a warning is printed and doesn't. The checks and their
 * thresholds are in `docs/buttondown.md`, *What `check` refuses in a post*.
 */
import {execFile} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {
  findPersonalData, personalDataSettings,
} from "../bin/check-personal-data.mjs";
import {
  CASOMO_CONFIG_KEYS, loadCasomoConfig, loadConfig,
} from "../bin/utils.mjs";
import {
  DEFAULT_MAX_GRADE, DEFAULT_WORD_SUBS, scoreText,
} from "../readability/index.mjs";

/** The banned-word list: `words` are checked, `inContext` words are wrong
 *  in one sense only, which a word match can't tell, so they are not. */
export const BANNED = JSON.parse(readFileSync(
  new URL("banned-words.json", import.meta.url), "utf8"));

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;
/** The line that opens a post's body names its subject. */
const HEADING = "# ";

/** An em dash, as the character or as any HTML entity for it. */
const EM_DASH = /—|&mdash;|&#8212;|&#x2014;/i;

/** The HTML elements a reader takes as a unit of their own. */
const BLOCK_END = /<\/(?:p|li|h[1-6]|figcaption|td|th|div|blockquote)>/gi;
/** A markdown line that stands alone: a heading, list item or table row. */
const BLOCK_LINE = /^[ \t]*(?:#+ |[-*+] |\d+\. |\|)/;
/** How a sentence ends, for the readability formulas. */
const ENDS_SENTENCE = /[.!?:;]\s*$/;
/** A block that isn't running prose: a heading, list, table, quote,
 *  caption or emphasis line, image or HTML block. */
const NOT_PARAGRAPH = /^(?:[#\-*+>|<!]|\d+\.)/;

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
  const raw = readFileSync(file, "utf8");
  const post = parsePost(raw);
  const config = await loadConfig("readability.config.mjs", root);
  return merge([
    readabilityProblems(post, {
      maxGrade: config.maxGrade ?? DEFAULT_MAX_GRADE,
      wordSubs: config.wordSubs ?? DEFAULT_WORD_SUBS,
    }),
    emDashProblems(post),
    bannedProblems(post),
    await personalDataProblems(raw, root),
    await spellingProblems(raw, root),
    await linkProblems(post, fetchImpl),
  ]);
}

/** A post split into the fields the gate reads. Like `draft`, it refuses a
 *  post whose body doesn't open on `# Subject`. */
export function parsePost(raw) {
  const m = raw.match(FRONT_MATTER);
  const fields = Object.fromEntries((m?.[1] ?? "").split("\n")
    .filter((line) => line.includes(":"))
    .map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }));
  const lines = (m ? raw.slice(m[0].length) : raw).trimStart().split("\n");
  if (!lines[0]?.startsWith(HEADING)) {
    throw new Error("after any front matter, the first line must be `# Subject`");
  }
  return {
    subject: lines[0].slice(HEADING.length).trim(),
    description: fields.description ?? "",
    image: fields.image ?? "",
    body: lines.slice(1).join("\n"),
  };
}

/** The words a reader reads: markup, code and URLs taken out, link text
 *  and alt text kept. */
export function proseOf(markdown) {
  const blocks = endBlocks(withoutCode(stripSpans(markdown, "<!--", "-->")));
  return stripSpans(blocks, "<", ">")
    .replace(/\]\([^)\s]*\)/g, " ")
    .replace(/!?\[/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/^[ \t]*(?:#+|>|[-*+]|\d+\.|\|)/gm, "")
    .replace(/[*_|]/g, " ");
}

/** The body's paragraphs: the blank-line-separated blocks of running text.
 *  The formulas score sentences, and a caption or list item dense with
 *  figures and titles reads as a hard sentence when it isn't one. */
export function paragraphsOf(body) {
  return body.split(/\n[ \t]*\n/).map((block) => block.trim())
    .filter((block) => block && !NOT_PARAGRAPH.test(block))
    .join("\n\n");
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

/** `text` with every span from `open` to the next `close` taken out. A
 *  scan rather than a lazy regex, which backtracks on an unclosed span. */
function stripSpans(text, open, close) {
  let out = "";
  let at = 0;
  for (let start = text.indexOf(open); start !== -1;
    start = text.indexOf(open, at)) {
    const end = text.indexOf(close, start + open.length);
    if (end === -1) break;
    out += `${text.slice(at, start)} `;
    at = end + close.length;
  }
  return out + text.slice(at);
}

/** `text` with fenced and inline code taken out. */
const withoutCode = (text) => stripSpans(stripSpans(text, "```", "```"), "`", "`");

/** Each block ended as a sentence, so the formulas don't read a list or a
 *  run of headings as one long sentence; a reader takes each on its own. */
function endBlocks(text) {
  return text.replace(BLOCK_END, ". ").split("\n")
    .map((line) => BLOCK_LINE.test(line) && !ENDS_SENTENCE.test(line)
      ? `${line}.` : line)
    .join("\n");
}

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
  const where = [
    ["subject", post.subject], ["description", post.description],
    ["body", withoutCode(post.body)],
  ].filter(([, text]) => EM_DASH.test(text)).map(([field]) => field);
  return where.length
    ? {problems: [`em dash in the ${where.join(", ")}: use a full stop, colon, `
      + "semicolon, comma or brackets"]}
    : {};
}

function bannedProblems(post) {
  const used = bannedIn(proseOf(
    [post.subject, post.description, post.body].join("\n")));
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
    ...linksOf(post.body), ...(/^https?:\/\//.test(post.image) ? [post.image] : []),
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
