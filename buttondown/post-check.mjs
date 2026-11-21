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
} from "../lib/casomo-config.mjs";
import {
  DEFAULT_MAX_GRADE, DEFAULT_WORD_SUBS, scoreText,
} from "../readability/index.mjs";
import {
  paragraphsOf, proseOf, withoutCode,
} from "../readability/markdown.mjs";
import {decodeEntities, escapeRegExp, startTags} from "../lib/html.mjs";
import {readerParts, readerText, readPost} from "./post.mjs";

/** The banned-word list: `words` are checked, `inContext` words are wrong
 *  in one sense only, which a word match can't tell, so they are not. */
export const BANNED = JSON.parse(readFileSync(
  new URL("banned-words.json", import.meta.url), "utf8"));

/** An em dash, as the character or by its name. A numeric reference
 *  is read back to the character first (`decodeEntities`), which keeps
 *  no `mdash`, so the name is matched here. */
const EM_DASH = /—|&mdash;/i;

/** The names cspell looks for its config under, in its own order. */
const CSPELL_CONFIGS = [
  ".cspell.json", "cspell.json", ".cSpell.json", "cSpell.json",
  "cspell.config.json", "cspell.config.mjs", "cspell.config.js",
  "cspell.config.yaml", "cspell.yaml",
];
/** cspell's exit status when it found unknown words, and nothing worse. */
const CSPELL_FOUND = 1;

/** A Markdown link's destination, without the title that may follow it.
 *  It may hold one level of balanced brackets, as CommonMark allows and a
 *  Wikipedia address needs (`/wiki/Foo_(bar)`). */
const MARKDOWN_LINK =
  /\]\((https?:\/\/(?:[^()\s]|\([^()\s]*\))+)(?:\s[^)]*)?\)/g;
/** The attributes an HTML tag links or loads a URL through. */
const LINK_ATTRIBUTES = new Set(["href", "src"]);
/** What starts a URL's fragment. */
const FRAGMENT = "#";
/** Where a fragment directive starts (`#id:~:text=…`); a browser strips it
 *  before it looks up the id. */
const TEXT_DIRECTIVE = ":~:";
/** The fragment every page has: a browser scrolls `#top` to the top. */
const TOP_FRAGMENT = "top";
/** The prefix GitHub serves a README heading's id with; its script scrolls
 *  `#id` to `user-content-id`. */
const GITHUB_ID_PREFIX = "user-content-";
/** A link that is gone for good: the page was removed, not mislaid. */
const NOT_FOUND = 404;
const GONE_FOR_GOOD = 410;
const GONE = new Set([NOT_FOUND, GONE_FOR_GOOD]);
/** A status from the publisher's side, which may clear on a retry. */
const SERVER_ERROR = 500;
/** A refusal from the publisher (403, 429), which says nothing either way
 *  about the page. */
const CLIENT_ERROR = 400;
/** The 2xx range: a page that answered, whose body can be searched for a
 *  fragment. */
const SUCCESS = 200;
const SUCCESS_END = 300;
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
  const captured = (pattern, read = (url) => url) =>
    [...text.matchAll(pattern)].map((m) => read(m[1]));
  // A link's destination has its references read back (`&amp;` as `&`), as
  // CommonMark reads every reference outside code (spec section 2.5), and
  // the tag reader reads an attribute's the same way; an autolink's are
  // kept as written, as CommonMark reads them.
  return [...new Set([
    ...captured(MARKDOWN_LINK, decodeEntities),
    ...startTags(text).flatMap(({attributes}) => attributes
      .flatMap(({name, value}) => (LINK_ATTRIBUTES.has(name)
        && /^https?:\/\//.test(value ?? "") ? [value] : []))),
    ...captured(/<(https?:\/\/[^>\s]+)>/g),
  ])];
}

/** Each banned word or phrase the prose uses, once. A typographic
 *  apostrophe matches a straight one. */
export function bannedIn(text, words = BANNED.words) {
  const plain = text.replace(/’/g, "'");
  return words.filter((w) => new RegExp(
    `(?<![\\w-])${escapeRegExp(w)}(?![\\w-])`, "i",
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
    .filter(([, text]) => EM_DASH.test(decodeEntities(withoutCode(text))))
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

/** Every link in the body, and the share image, fetched: each page once,
 *  however many of its fragments the post links to. When every page failed
 *  for a reason a retry might clear, the check didn't run, which is said
 *  once rather than per page. */
async function linkProblems(post, fetchImpl) {
  const urls = [...new Set([
    ...linksOf(post.body),
    ...(/^https?:\/\//.test(post.fields.image ?? "") ? [post.fields.image] : []),
  ])];
  const pages = new Map();
  for (const url of urls) {
    const {fetchHref} = pageOf(url);
    pages.set(fetchHref, [...pages.get(fetchHref) ?? [], url]);
  }
  const outcomes = await Promise.all([...pages]
    .map(([fetchHref, links]) => pageOutcome(fetchHref, links, fetchImpl)));
  if (pages.size && outcomes.every((o) => o.transient)) {
    return {warnings: [`links: none of ${pages.size} could be checked (network?)`]};
  }
  return merge(outcomes);
}

/** One page's status, and each fragment linked on it that no element on the
 *  page carries. A page linked once is named as the post writes it. A
 *  missing fragment is not retried: the page answered, so it isn't
 *  transient. On a page that redirected elsewhere it only warns, since a
 *  consent wall or a sign-in page says nothing about the page linked. */
async function pageOutcome(page, links, fetchImpl) {
  const name = links.length === 1 ? links[0] : page;
  const fragments = links.flatMap((link) => {
    const anchor = anchorOf(link);
    return anchor ? [{link, ...anchor}] : [];
  });
  const fetchOnce = () => fetchPage(page, fetchImpl, {readHtml: fragments.length > 0});
  let r = await fetchOnce();
  if (transient(r)) r = await fetchOnce();
  if (GONE.has(r.status)) return {problems: [`link ${r.status}: ${name}`]};
  if (transient(r)) {
    return {transient: true,
      warnings: [`link ${r.status ?? r.error} after a retry: ${name}`]};
  }
  if (r.status >= CLIENT_ERROR) return {warnings: [`link ${r.status}: ${name}`]};
  if (r.html === undefined) return {};
  const ids = idsOf(r.html);
  const missing = fragments.filter(({raw, decoded}) =>
    !ids.has(raw) && !ids.has(decoded));
  return r.redirectedTo
    ? {warnings: missing.map(({link, decoded}) => `link fragment #${decoded} `
      + `not checked: ${link} redirected to ${r.redirectedTo}`)}
    : {problems: missing.map(({link, decoded}) =>
      `link fragment #${decoded} not on page: ${link}`)};
}

/** The fragment a link points at, as written and percent-decoded, looked up
 *  in that order as the HTML spec does; or undefined when there is none to
 *  look for: no fragment, an empty one, `#top` in any case and however
 *  encoded (every page has it), a hash route that a script reads, or a text
 *  fragment. A text directive after an id (`#id:~:text=`) leaves the id to
 *  check, as a browser scrolls to it. */
function anchorOf(link) {
  const at = link.indexOf(FRAGMENT);
  if (at < 0) return undefined;
  const raw = link.slice(at + 1).split(TEXT_DIRECTIVE)[0];
  const decoded = percentDecoded(raw);
  const hashRoute = /^[/!]/.test(raw);
  if (!raw || decoded.toLowerCase() === TOP_FRAGMENT || hashRoute) return undefined;
  return {raw, decoded};
}

function percentDecoded(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    // An undecodable fragment is looked up as written.
    return raw;
  }
}

/** Every id a start tag on the page carries, and every `<a name>`, which a
 *  fragment also scrolls to; a GitHub `user-content-` id counts as the id
 *  its script scrolls to. Tags are read by `startTags`, so an `id=` inside
 *  another attribute's value or in the text between tags is not an id, and
 *  one in a comment or a script's string still is. The check reads the
 *  served HTML only, so an id a script adds is invisible to it, and a link
 *  to one must drop its fragment. */
function idsOf(html) {
  const ids = startTags(html).flatMap(({name: tag, attributes}) =>
    attributes.flatMap(({name, value}) => {
      const anchors = name === "id" || (name === "name" && tag === "a");
      return anchors && value !== undefined ? [value] : [];
    }));
  return new Set([...ids, ...ids.filter((id) => id.startsWith(GITHUB_ID_PREFIX))
    .map((id) => id.slice(GITHUB_ID_PREFIX.length))]);
}

const transient = (r) => r.error || r.status >= SERVER_ERROR;
const isSuccess = (status) => status >= SUCCESS && status < SUCCESS_END;

/** A 2xx answer whose body is HTML, the one kind a fragment is looked up
 *  in. */
const isHtmlPage = (res) => isSuccess(res.status)
  && /^text\/html\b/i.test(res.headers.get("content-type") ?? "");

/** The page a URL names. `fetchHref` is the URL as written without its
 *  fragment: what is fetched, and what the post's links are grouped by, so
 *  every spelling a post writes is fetched. `samePageKey` is shared by two
 *  URLs a redirect between which lands on the same page: one that only adds
 *  or drops a trailing slash or a leading `www.`, or moves http to https.
 *  A URL that doesn't parse is its own key, for the fetch to refuse. */
function pageOf(url) {
  const fetchHref = url.split(FRAGMENT)[0];
  if (!URL.canParse(fetchHref)) return {fetchHref, samePageKey: fetchHref};
  const {host, pathname, search} = new URL(fetchHref);
  const path = pathname.replace(/\/$/, "");
  return {fetchHref,
    samePageKey: `${host.replace(/^www\./, "")}${path}${search}`};
}

/** One page's status, or the error that stopped it. With `readHtml`, a 2xx
 *  `text/html` page's body comes back as `html`, for its fragments to be
 *  looked up, with `redirectedTo` set when it is another page than the one
 *  asked for; any other body is left unread. */
async function fetchPage(url, fetchImpl, {readHtml}) {
  try {
    const res = await fetchImpl(url, {
      redirect: "follow", signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
    });
    if (readHtml && isHtmlPage(res)) {
      const moved = res.redirected && pageOf(res.url).samePageKey
        !== pageOf(url).samePageKey;
      return {status: res.status, html: await res.text(),
        ...(moved ? {redirectedTo: res.url} : {})};
    }
    await res.body?.cancel();
    return {status: res.status};
  } catch (error) {
    return {error: error?.name ?? String(error)};
  }
}
