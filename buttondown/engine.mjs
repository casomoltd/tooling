/**
 * A Buttondown newsletter kept as code: its settings, skins and emails live
 * in the repo, and this applies them to the live newsletter and gates them.
 * The `buttondown` command drives it; `index.mjs` is the narrow public entry
 * a repo's own files import.
 *
 * A repo configures it under `buttondown` in its `casomo.config.mjs`:
 *
 *   import {EMAIL_CHROME_HIDES, WEB_CHROME_HIDES}
 *     from "@casomoltd/tooling/buttondown";
 *
 *   export default {
 *     buttondown: {
 *       newsletter: {id, publicId, username}, // the one newsletter written
 *       globals: "src/app/globals.css",       // the site's design tokens
 *       dir: "buttondown",                    // newsletter.json and fields/
 *       tokens: [["--color-accent", "--color-brand-accent"]], // target, source
 *       extra: [["--radius", "0"]],           // uncommented lines after them
 *       asserts: {"--radius-lg": "0"},        // tokens the skins depend on
 *       allowedHides: {...EMAIL_CHROME_HIDES, ...WEB_CHROME_HIDES, // the
 *         second for a repo that composes its web skin
 *         ".selector": "why"},
 *       linkClasses: {onDark: "on-dark"},     // each needs an `a.<class>` rule
 *       ownLinks: ["/rss"],                   // hrefs that are not socials
 *       paletteFiles: ["buttondown/assets/icon.svg"],
 *       checks: ["buttondown/checks.mjs"],    // the repo's own gates
 *       webSkin: "buttondown/skins/web.css",  // if composed: TOKENS' file
 *     },
 *   };
 *
 * `newsletter.json` holds the newsletter's short fields (its `image` is
 * also every draft's default share image), `tags.json` its
 * tags, and each file in `fields/` is the field it is named after: a
 * stylesheet is read verbatim, and an `.mjs` file's default export is the
 * field's value.
 */
import {existsSync} from "node:fs";
import {mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {CASOMO_CONFIG_KEYS, loadCasomoConfig} from "../bin/casomo-config.mjs";
import {readToken} from "../tokens/block.mjs";
import {detail, DRAFT, newsletterPath} from "./api.mjs";
import {assertAbsoluteUrl, readPost, withId} from "./post.mjs";
import {markers, skinProblems, skinsOf, tokensBlock} from "./skin-check.mjs";

/**
 * Buttondown's email chrome, for a repo whose emails draw their own header
 * and footer bands. Not allowed by default: a repo opts in by spreading it
 * into `allowedHides`.
 */
export const EMAIL_CHROME_HIDES = {
  ".social-links": "the web footer's links, duplicated in an email",
  ".newsletter-masthead": "replaced by the repo's own header band",
  ".transactional-email-header":
    "the icon, subject and name above a transactional email's own bands",
  ".newsletter-icon": "the icon slot above the repo's own mark",
  ".email-preamble": "the forwarding prompt between title and prose",
  ".colophon": "the sender-and-date line under the hidden masthead",
  ".email-actions--unsubscribe": "duplicated by the repo's own footer",
  ".powered-by-icon": "the logo tile above the kept attribution line",
};

/**
 * Buttondown's controls on the hosted pages that send a reader somewhere
 * worse than the site does. `composeWebSkin` hides them, so a repo that
 * composes its web skin spreads this into `allowedHides`, as it does
 * EMAIL_CHROME_HIDES. The manage-link hide assumes the archive is on a
 * custom domain, where that link's buttondown.com address asks a signed-in
 * reader to sign in again; on buttondown.com it is their only manage link.
 */
export const WEB_CHROME_HIDES = {
  "a.sniper-link-button":
    "a button to the reader's mail provider, in the form's place and in the"
    + " sign-up dialog; their inbox is theirs to go to",
  [".subscribe:has(span.confirmation-email-message)"
    + " #subscribe-form a.archive__button"]:
    "a signed-in reader's manage link, which goes to buttondown.com and asks"
    + " them to sign in again; the header's Account link opens the same"
    + " settings on the site's domain",
};

/** Fields Buttondown stores behind its image proxy. */
const IMAGE_FIELDS = new Set(["icon", "image"]);

/** The newsletter's identity, which only casomo.config.mjs may carry: a
 *  field of that name in newsletter.json would be sent as a setting. */
const IDENTITY = ["id", "publicId", "username"];

/** Hrefs Buttondown draws itself, which no socials entry names. */
const BUTTONDOWN_LINKS = ["buttondown.com"];

/** Shorter fields are settings, not documents, and `emit` leaves them to
 *  newsletter.json, where they already read plainly. */
const EMIT_MIN_LENGTH = 200;

/** What a repo's config may leave out, and what it then means. */
const CONFIG_DEFAULTS = {
  dir: "buttondown", tokens: [], extra: [], asserts: {}, allowedHides: {},
  linkClasses: {}, ownLinks: [], paletteFiles: [], checks: [],
  // `webSkin`'s default is under `dir`, so `loadSettings` resolves it.
};

/** The repo's settings, every path absolute. Throws where the newsletter
 *  or the tokens file is not named, since either would otherwise be
 *  guessed. */
export async function loadSettings(root = process.cwd()) {
  const named = await loadCasomoConfig(CASOMO_CONFIG_KEYS.buttondown, root);
  assertNamed(named);
  const config = withDefaults(named);
  const at = (p) => path.resolve(root, p);
  const dir = at(config.dir);
  return {
    root,
    newsletter: config.newsletter,
    dir,
    globals: at(config.globals),
    tokens: config.tokens,
    extra: config.extra,
    asserts: config.asserts,
    allowedHides: config.allowedHides,
    linkClasses: Object.values(config.linkClasses),
    ownLinks: [...BUTTONDOWN_LINKS, ...config.ownLinks],
    // The file holding the web skin's TOKENS block, which `tokens`
    // rewrites: the field file itself unless the field is composed.
    webSkin: config.webSkin
      ? at(config.webSkin) : path.join(dir, "fields", "web_css.css"),
    paletteFiles: config.paletteFiles.map(at),
    checks: config.checks.map(at),
  };
}

/** A reader for one stylesheet's tokens, for a repo's email blocks. */
export async function tokenReader(file) {
  const css = await readFile(file, "utf8");
  return (name) => readToken(css, name);
}

/** Every field the newsletter is set to: newsletter.json, then fields/. */
export async function buildPayload(settings) {
  const payload = await readNewsletter(settings);
  const identity = IDENTITY.filter((key) => key in payload);
  if (identity.length) {
    throw new Error(
      `newsletter.json holds ${identity.join(", ")}: the newsletter's `
      + "identity belongs in casomo.config.mjs, not among its fields",
    );
  }
  const dir = path.join(settings.dir, "fields");
  for (const file of (await readdir(dir)).sort()) {
    const field = file.replace(/\.[a-z]+$/, "");
    if (field in payload) {
      throw new Error(
        `${field} is set in both newsletter.json and fields/${file}`,
      );
    }
    const full = path.join(dir, file);
    if (!file.endsWith(".mjs")) {
      payload[field] = await readFile(full, "utf8");
      continue;
    }
    // A module may build a structured field too, such as `socials` from
    // the site's own footer links, so the two cannot drift apart.
    const value = (await import(pathToFileURL(full).href)).default;
    if (typeof value !== "string" && (!value || typeof value !== "object")) {
      throw new Error(`fields/${file} must default-export a string, an `
        + `array or an object, got ${value === null ? "null" : typeof value}`);
    }
    payload[field] = value;
  }
  return payload;
}

/** Every problem with the repo's skins and settings, then each problem
 *  its own checks find; empty when clean. */
export async function runCheck(settings) {
  const css = await readFile(settings.globals, "utf8");
  const payload = await buildPayload(settings);
  const problems = await skinProblems(settings, {css, payload});
  for (const file of settings.checks) {
    problems.push(...await repoCheck(settings, file, {css, payload}));
  }
  return problems;
}

/** Rewrites the web skin's TOKENS block from the site's tokens. */
export async function writeTokens(settings) {
  const css = await readFile(settings.globals, "utf8");
  const file = settings.webSkin;
  const web = await readFile(file, "utf8");
  const {s, e} = markers(web);
  await writeFile(
    file, web.slice(0, s) + tokensBlock(settings, css) + web.slice(e),
  );
}

/** Whether a live value already says what the repo wants. */
export function same(field, got, want) {
  if (IMAGE_FIELDS.has(field)) return sameImage(got, want);
  if (typeof want === "string") {
    return typeof got === "string" && got.trim() === want.trim();
  }
  if (Array.isArray(want)) {
    return Array.isArray(got) && got.length === want.length
      && want.every((item, i) => same(field, got[i], item));
  }
  if (want && typeof want === "object") return sameObject(got, want);
  return got === want;
}

/** What live differs in: the newsletter's fields and its tags. */
export async function drift(settings, api) {
  const [payload, current, tags] = await Promise.all([
    buildPayload(settings), api.live(), tagDrift(settings, api),
  ]);
  return {
    payload,
    differs: Object.keys(payload).filter(
      (field) => !same(field, current[field], payload[field]),
    ),
    tags,
  };
}

/**
 * Patches what differs, in one call where Buttondown takes it. A
 * plan-gated field makes Buttondown refuse the whole call, naming a
 * feature rather than the field, so a refusal falls back to one field at
 * a time. Returns what was refused, so a caller can fail on a partial
 * write.
 */
export async function apply(settings, api, log = console.log) {
  const {payload, differs, tags} = await drift(settings, api);
  if (!differs.length && !tags.length) {
    log("buttondown: live already matches");
    return {refused: []};
  }
  const refused = differs.length
    ? await patchFields(settings, api, {payload, differs}, log) : [];
  refused.push(...await patchTags(api, tags, log));
  return {refused};
}

/**
 * A draft from a markdown file whose first line, after any front matter,
 * is `# Subject`. Front matter carries the email's id once it exists, so a
 * re-run replaces that draft rather than creating a second; `slug` and
 * `description` are passed through, and `image` (the share image) defaults
 * to the newsletter's own. An email already sent is refused:
 * replacing it would rewrite the published archive.
 */
export async function draft(settings, api, file, log = console.log) {
  const post = await readPost(file);
  const body = await draftBody(settings, post);
  const {id} = post.fields;
  if (id) {
    const current = await api.call("GET", `/emails/${id}`);
    if (!current.ok) throw new Error(`GET email: ${detail(current)}`);
    if (current.data.status !== DRAFT) {
      throw new Error(`${id} is ${current.data.status}, not a draft; `
        + "replacing it would rewrite what was published");
    }
    const res = await api.call("PATCH", `/emails/${id}`, body);
    if (!res.ok) throw new Error(`refused: ${detail(res)}`);
    log(`updated draft ${res.data.id}`);
    return;
  }
  const res = await api.call("POST", "/emails", {...body, status: DRAFT});
  if (!res.ok) throw new Error(`refused: ${detail(res)}`);
  await writeFile(file, withId(post, res.data.id));
  log(`created draft ${res.data.id}; id written back into ${file}`);
}

/** Uploads an image and returns its Buttondown URL: the newsletter's
 *  images must be Buttondown's own, not linked from elsewhere. */
export async function upload(api, file) {
  const form = new FormData();
  form.append("image", new Blob([await readFile(file)]), path.basename(file));
  const res = await api.call("POST", "/images", undefined, {form});
  if (!res.ok || !res.data?.image) {
    throw new Error(`upload refused: ${detail(res)}`);
  }
  return res.data.image;
}

/** Writes each long field out as rendered, so what Buttondown receives
 *  can be read and diffed directly. */
export async function emit(settings, dir) {
  const payload = await buildPayload(settings);
  await mkdir(dir, {recursive: true});
  const written = [];
  for (const [field, value] of Object.entries(payload)) {
    if (typeof value !== "string" || value.length < EMIT_MIN_LENGTH) continue;
    await writeFile(path.join(dir, field), value);
    written.push(field);
  }
  return written;
}

/** The email a post becomes. `slug` and `description` pass through only
 *  when the front matter sets them. */
async function draftBody(settings, post) {
  // The marker says the body is markdown (Buttondown's `plaintext` mode).
  // Without it Buttondown guesses, and a draft once stored as rich text
  // takes the next PATCH as rich text too.
  const body = {
    subject: post.subject,
    body: `<!-- buttondown-editor-mode: plaintext -->\n${post.body.trim()}`,
    ...Object.fromEntries(["slug", "description"]
      .filter((k) => k in post.fields).map((k) => [k, post.fields[k]])),
  };
  // Left unset, Buttondown takes the post's first picture as its share
  // image, so every post would preview differently; the newsletter's own
  // share image is the default, and `image:` in the front matter wins.
  // The post's own image was checked when it was read.
  const image = post.fields.image ?? (await readNewsletter(settings)).image;
  if (image) body.image = image;
  return body;
}

/** newsletter.json, parsed and with its image fields checked. */
async function readNewsletter(settings) {
  const file = path.join(settings.dir, "newsletter.json");
  let payload;
  try {
    payload = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`, {cause: error});
  }
  for (const field of IMAGE_FIELDS) {
    if (payload[field]) assertAbsoluteUrl(field, payload[field]);
  }
  return payload;
}

/**
 * Each tag in tags.json whose live fields differ, keyed by id rather than
 * name: a tag's name is the label a subscriber reads in their preferences,
 * so renaming one is an ordinary edit, and a lookup by name would miss on
 * exactly that edit. The name is the fallback for a tag whose id is not
 * written in yet; a tag found by neither comes back without a `tagId`.
 */
async function tagDrift(settings, api) {
  const file = path.join(settings.dir, "tags.json");
  if (!existsSync(file)) return [];
  const live = await api.list("/tags");
  return JSON.parse(await readFile(file, "utf8")).flatMap(({id, ...body}) => {
    const current = live.find((t) => t.id === id)
      ?? (id ? undefined : live.find((t) => t.name === body.name));
    if (current && same("tag", current, body)) return [];
    return [{tagId: current?.id, body}];
  });
}

/** The config with each unset key at its default; null counts as unset. */
function withDefaults(config) {
  const filled = {...config};
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    filled[key] = config[key] ?? value;
  }
  return filled;
}

/** Throws where the newsletter or the tokens file is not named. */
function assertNamed(config) {
  const {id, username} = config.newsletter ?? {};
  if (!id || !username) {
    throw new Error(
      "casomo.config.mjs needs buttondown.newsletter with an id and a "
      + "username: it is the one newsletter this repo may write to",
    );
  }
  if (!config.globals) {
    throw new Error("casomo.config.mjs needs buttondown.globals: the "
      + "stylesheet the site's design tokens are declared in");
  }
}

/** The problems one of the repo's own check modules finds. */
async function repoCheck(settings, file, {css, payload}) {
  const check = (await import(pathToFileURL(file).href)).default;
  const found = await check({
    root: settings.root, payload, css, ...skinsOf(payload), readToken,
  });
  if (!Array.isArray(found)) {
    throw new Error(`${path.relative(settings.root, file)} must resolve `
      + "to an array of problems");
  }
  return found;
}

/** Whether a live object holds every key the repo sets, at its value. A
 *  live object may carry keys the repo does not set. */
function sameObject(got, want) {
  return !!got && typeof got === "object"
    && Object.entries(want).every(([k, v]) => same(k, got[k], v));
}

/** Whether a live image is the one the repo names. */
function sameImage(got, want) {
  if (!want) return !got;
  let url;
  try {
    url = new URL(got);
  } catch {
    // Unset, or not a URL at all: not the image the repo names.
    return false;
  }
  // Buttondown stores an image behind its proxy, with the original URL
  // percent-encoded in the path, so compare the decoded host and path.
  const decoded = decodeURIComponent(`${url.origin}${url.pathname}`);
  const w = new URL(want);
  return decoded.endsWith(`${w.host}${w.pathname}`);
}

/** Patches the differing fields, whole and then one by one if refused;
 *  returns the fields refused. */
async function patchFields(settings, api, {payload, differs}, log) {
  const url = newsletterPath(settings.newsletter);
  const body = Object.fromEntries(differs.map((f) => [f, payload[f]]));
  const whole = await api.call("PATCH", url, body);
  if (whole.ok) {
    api.assertNewsletter(whole.data, "after writing");
    log(`buttondown: updated ${differs.join(", ")}`);
    return [];
  }
  log(`buttondown: whole PATCH refused (${detail(whole)}); field by field:`);
  const refused = [];
  for (const field of differs) {
    const one = await api.call("PATCH", url, {[field]: payload[field]});
    if (!one.ok) {
      refused.push(field);
      log(`  REFUSED  ${field}: ${detail(one)}`);
      continue;
    }
    api.assertNewsletter(one.data, "after writing");
    log(`  ok       ${field}`);
  }
  return refused;
}

/** Patches each differing tag; returns the tags refused or not found. */
async function patchTags(api, tags, log) {
  const refused = [];
  for (const {tagId, body} of tags) {
    if (!tagId) {
      refused.push(`tag ${body.name}`);
      log(`  tag ${body.name}: not on the account`);
      continue;
    }
    const res = await api.call("PATCH", `/tags/${tagId}`, body);
    if (!res.ok) refused.push(`tag ${body.name}`);
    const outcome = res.ok ? "updated" : `REFUSED ${detail(res)}`;
    log(`  tag ${body.name}: ${outcome}`);
  }
  return refused;
}
