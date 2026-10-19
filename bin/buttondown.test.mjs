#!/usr/bin/env node
// Tests for the Buttondown engine. Each case builds its own repo in a temp
// directory, and every API call goes to a stubbed fetch, so nothing reaches
// a real newsletter. Every guard is watched failing.
import {strict as assert} from "node:assert";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync,
} from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {
  apply, assertApiPath, buildPayload, client, draft, drift, emit, END,
  EMAIL_CHROME_HIDES, loadSettings, readKey, readToken, runCheck, same,
  START, writeTokens,
} from "../buttondown/engine.mjs";

const NEWSLETTER = {id: "uuid-1", publicId: "news_1", username: "example"};

const GLOBALS = `:root {
  --color-brand-accent: #123456;
  --color-brand-ink: #222222;
  --radius-lg: 0;
}
.dark {
  --color-brand-accent: #654321;
}
`;

const block = [
  START,
  "  --accent: #123456; /* --color-brand-accent */",
  "  --radius: 0;",
  END,
].join("\n");
const root = `:root {\n${block}\n}`;

/** A repo with a clean skin; `files` replaces or adds files, and a config
 *  key set to undefined is left out. */
function repo(files = {}, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), "buttondown-"));
  const all = {
    "casomo.config.mjs": `export default {buttondown: ${JSON.stringify({
      newsletter: NEWSLETTER,
      globals: "tokens.css",
      tokens: [["--accent", "--color-brand-accent"]],
      extra: [["--radius", "0"]],
      asserts: {"--radius-lg": "0"},
      allowedHides: EMAIL_CHROME_HIDES,
      linkClasses: {onDark: "on-dark"},
      ...config,
    })}};`,
    "tokens.css": GLOBALS,
    "buttondown/newsletter.json": JSON.stringify({name: "Example"}),
    "buttondown/fields/socials.mjs": "export default [{type: 'generic', "
      + "url: 'https://example.com/', label: 'Home'}];",
    "buttondown/fields/web_css.css":
      `${root}\n.a { color: #222; }\n`
      + 'a[href="https://example.com/"] { color: #123456; }\n',
    "buttondown/fields/css.css":
      ".newsletter-masthead { display: none !important; }\n"
      + "a.on-dark { color: #222222 !important; }\n",
    "buttondown/fields/footer.mjs": "export default 'footer';",
    ...files,
  };
  for (const [name, text] of Object.entries(all)) {
    if (text === undefined) continue;
    mkdirSync(join(dir, name, ".."), {recursive: true});
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const problems = async (files, config) =>
  runCheck(await loadSettings(repo(files, config)));

// A clean repo passes, its socials built by a module.
assert.deepEqual(await problems(), []);

const web = (extra) => ({
  "buttondown/fields/web_css.css": `${root}\n${extra}\n`,
});
const fails = async (files, pattern, config) => {
  const found = await problems(files, config);
  assert.ok(found.some((p) => pattern.test(p)),
    `expected ${pattern}, got ${JSON.stringify(found)}`);
};
const passes = async (files, config) =>
  assert.deepEqual(await problems(files, config), []);

// The tokens: a stale block, a broken assert, a missing or repeated block.
await fails({"buttondown/fields/web_css.css":
  root.replace("#123456", "#222222")}, /TOKENS block is stale/);
await fails({"tokens.css": GLOBALS.replace("lg: 0", "lg: 4px")},
  /--radius-lg is 4px/);
await assert.rejects(problems(web(root)), /exactly one TOKENS block/);
await assert.rejects(problems({"buttondown/fields/web_css.css":
  `${END}\n${START}`}), /exactly one TOKENS block/);

// A token is read from a top-level :root or @theme, never from a variant
// above it: another selector, a qualified :root, or one inside an at-rule.
for (const variant of [".dark", ":root.dark", ":root[data-theme=dark]",
  "@media (prefers-color-scheme: dark) { :root"]) {
  const close = variant.includes("{") ? "}}" : "}";
  assert.equal(readToken(`${variant} {\n  --x: #000;\n${close}\n`
    + ":root {\n  --x: #fff;\n}", "--x"), "#fff", variant);
}
assert.equal(readToken("@theme inline {\n  --x: #fff;\n}", "--x"), "#fff");
// A comment before the block is not its head, even one holding a `;`.
for (const comment of ["/* tokens */", "/* tokens; kept in sync */"]) {
  assert.equal(readToken(`@import "a";\n${comment}\n@theme {\n  --x: #fff;\n}`,
    "--x"), "#fff", comment);
}
assert.throws(() => readToken(".dark {\n  --x: #000;\n}", "--x"),
  /not found in a :root or @theme block/);

// Colours: in values, in an SVG's attributes, never in a selector.
await fails(web(".a { color: #abcdef; }"), /off-palette colour #abcdef/);
await passes(web("a:not(#cafe) { color: #222; }"));
await fails({"logo.svg": '<svg fill="#abcdef"/>'},
  /off-palette colour #abcdef in logo.svg/, {paletteFiles: ["logo.svg"]});

// Hides: one marked important is still a hide, inside an at-rule or not;
// the email chrome is allowed only when the repo opts in.
await fails(web(".b { display: none !important; }"), /hides \.b/);
await fails(web("@media (min-width: 1px) { .c { font-size: 0; } }"),
  /hides \.c/);
await fails({}, /hides \.newsletter-masthead/, {allowedHides: {}});

// Injected text; removing it, or a layout property ending in content, is
// not injection.
await fails(web(".d::before { content: 'x'; }"), /injects/);
await passes(web(".d::before { content: none; }"));
await passes(web(".e { justify-content: center; }"));

// Hrefs the skin keys on must be socials or the repo's own links, however
// the selector is quoted.
await fails(web('a[href="https://gone.example/"] { color: #222; }'),
  /matches no socials URL/);
await fails(web("a[href^='https://gone.example'] { color: #222; }"),
  /matches no socials URL/);
await fails(web("a[href$=gone] { color: #222; }"), /matches no socials URL/);
await fails(web('a[href^="https://gone" i] { color: #222; }'),
  /matches no socials URL/);
await fails(web('a[href~="gone"] { color: #222; }'), /matches no socials URL/);
await fails(web('a[href|="gone"] { color: #222; }'), /matches no socials URL/);
await passes(web("a[href*='/rss'] { color: #222; }"), {ownLinks: ["/rss"]});

// The class name must end where the rule's does.
await fails({"buttondown/fields/css.css":
  "a.on-darker { color: #222; }"}, /"on-dark" has no a\.on-dark rule/);

// A repo's own gate runs with the rest, and must answer with a list.
await fails({"gate.mjs": "export default async () => ['own gate failed'];"},
  /own gate failed/, {checks: ["gate.mjs"]});
await assert.rejects(problems({"gate.mjs": "export default async () => {};"},
  {checks: ["gate.mjs"]}), /gate.mjs must resolve to an array/);

// The identity and the tokens file are named in config, never guessed, and
// the identity is never sent as a field.
await assert.rejects(loadSettings(repo({}, {newsletter: {id: "x"}})),
  /needs buttondown.newsletter/);
await assert.rejects(loadSettings(repo({}, {globals: undefined})),
  /needs buttondown.globals/);
await assert.rejects(problems({"buttondown/newsletter.json":
  JSON.stringify({id: "uuid-1"})}), /identity belongs in casomo.config/);
await assert.rejects(problems({"buttondown/fields/name.css": "x"}),
  /name is set in both/);
await assert.rejects(problems({"buttondown/newsletter.json":
  JSON.stringify({icon: "images/a.png"})}), /icon must be an absolute URL/);
await assert.rejects(problems({"buttondown/fields/n.mjs": "export default 1;"}),
  /must default-export a string, an array or an object, got number/);

// The key comes only from the file BUTTONDOWN_KEY_FILE names.
await assert.rejects(readKey({}), /set BUTTONDOWN_KEY_FILE/);
const keyDir = repo({"key": "  secret\n", "empty": "\n"});
assert.equal(await readKey({BUTTONDOWN_KEY_FILE: join(keyDir, "key")}),
  "secret");
await assert.rejects(readKey({BUTTONDOWN_KEY_FILE: join(keyDir, "empty")}),
  /is empty/);

// A proxied image matches the URL it was uploaded from; an unset one does
// not, and does not throw; a live object may carry keys the repo does not.
assert.ok(same("icon",
  "https://attachments.example/https%3A//assets.example/images/a.png",
  "https://assets.example/images/a.png"));
assert.ok(!same("icon", "", "https://assets.example/images/a.png"));
assert.ok(same("theme_configuration", {a: "1", b: "2"}, {a: "1"}));
assert.ok(!same("theme_configuration", {a: "2"}, {a: "1"}));

// `tokens` rewrites the block in place, after which the check is clean.
const stale = repo({"buttondown/fields/web_css.css":
  `${root.replace("#123456", "#222222")}\n.a { color: #222; }\n`});
await writeTokens(await loadSettings(stale));
assert.deepEqual(await runCheck(await loadSettings(stale)), []);

// `emit` writes a text field of 200 characters or more, and no shorter.
const out = join(repo(), "emitted");
const emitted = await emit(await loadSettings(repo({
  "buttondown/fields/footer.mjs": `export default '${"x".repeat(200)}';`,
  "buttondown/fields/header.mjs": `export default '${"x".repeat(199)}';`,
})), out);
assert.ok(emitted.includes("footer") && !emitted.includes("header"));
assert.ok(existsSync(join(out, "footer")));

// `api` writes newsletter settings only to this newsletter, judged on the
// path fetch will request.
const settingsOf = await loadSettings(repo());
assert.doesNotThrow(() => assertApiPath(settingsOf, "PATCH",
  "/newsletters/uuid-1"));
assert.doesNotThrow(() => assertApiPath(settingsOf, "GET",
  "/newsletters/other"));
assert.doesNotThrow(() => assertApiPath(settingsOf, "POST", "/subscribers"));
for (const url of ["/newsletters/other", "/./newsletters/other",
  "/newsletters/uuid-1/../other", "/newsletters/uuid-10",
  "/%6eewsletters/other"]) {
  assert.throws(() => assertApiPath(settingsOf, "PATCH", url),
    /only to \/v1\/newsletters\/uuid-1/, url);
}
assert.throws(() => assertApiPath(settingsOf, "PATCH",
  "/%256eewsletters/other"), /refuses an encoded path/);

/**
 * A stubbed API: the newsletter in `live`, tags in pages of one, and
 * emails by id. Records every call.
 */
function stub(live, {
  refuse = [], tags = [], emails = {}, returns, tagsFail, refuseTags,
} = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const {pathname, searchParams} = new URL(url);
    const body = typeof init.body === "string"
      ? JSON.parse(init.body) : undefined;
    calls.push({method: init.method, pathname, body,
      context: init.headers["Buttondown-Context"]});
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), {status});
    if (pathname === "/v1/tags") {
      const page = Number(searchParams.get("page") ?? 1);
      if (page === tagsFail) return reply({detail: "down"}, 500);
      return reply({results: tags.slice(page - 1, page),
        next: page < tags.length
          ? `https://api.example/v1/tags?page=${page + 1}` : null});
    }
    if (pathname.startsWith("/v1/tags/")) {
      return refuseTags ? reply({detail: "no"}, 400) : reply({});
    }
    if (pathname.startsWith("/v1/emails/")) {
      const email = emails[pathname.split("/").pop()];
      if (init.method === "PATCH") Object.assign(email, body);
      return reply(email);
    }
    if (pathname === "/v1/emails") return reply({id: "em_new", ...body});
    if (init.method === "PATCH") {
      if (Object.keys(body).some((k) => refuse.includes(k))) {
        return reply({detail: "plan"}, 400);
      }
      Object.assign(live, body);
      return reply(returns ?? live);
    }
    return reply(live);
  };
  return calls;
}

const settings = await loadSettings(repo());
const api = () => client(settings, "k");
const current = () => ({...NEWSLETTER, name: "Old", socials: [],
  css: "", web_css: "", footer: "footer"});
const quiet = () => {};

// Only the fields that differ are patched, and every call names the
// newsletter.
let live = current();
let calls = stub(live);
assert.deepEqual(await apply(settings, api(), quiet), {refused: []});
const patch = calls.find((c) => c.method === "PATCH");
assert.deepEqual(Object.keys(patch.body).sort(),
  ["css", "name", "socials", "web_css"]);
assert.ok(calls.every((c) => c.context === "uuid-1"));
assert.deepEqual((await drift(settings, api())).differs, []);

// A refused whole PATCH falls back to one field at a time, and the refused
// field is reported so the command can fail.
live = current();
calls = stub(live, {refuse: ["css"]});
assert.deepEqual(await apply(settings, api(), quiet), {refused: ["css"]});
assert.equal(calls.filter((c) => c.method === "PATCH").length, 5);

// The wrong newsletter, by username or by id, stops the run before
// anything is written.
for (const wrong of [{username: "someone-else"}, {id: "uuid-2"}]) {
  live = {...current(), ...wrong};
  calls = stub(live);
  await assert.rejects(apply(settings, api(), quiet), /before writing/);
  assert.ok(calls.every((c) => c.method === "GET"));
}

// A write that comes back from another newsletter is reported.
live = current();
stub(live, {returns: {...current(), username: "someone-else"}});
await assert.rejects(apply(settings, api(), quiet), /after writing/);

// The prefixed publicId some endpoints return is accepted as the same one.
live = {...current(), id: "news_1"};
stub(live);
await apply(settings, api(), quiet);
assert.equal(live.name, "Example");

// Tags: read across every page, matched by id then by name, patched only
// where they differ; one on neither is refused.
const tagged = await loadSettings(repo({"buttondown/tags.json":
  JSON.stringify([
    {id: "t1", name: "One", subscriber_editable: true},
    {name: "Two", subscriber_editable: false},
    {name: "Three"},
  ])}));
live = {...NEWSLETTER, ...await buildPayload(tagged)};
calls = stub(live, {tags: [
  {id: "t1", name: "One", subscriber_editable: true},
  {id: "t2", name: "Two", subscriber_editable: true},
]});
assert.deepEqual(await apply(tagged, client(tagged, "k"), quiet),
  {refused: ["tag Three"]});
assert.deepEqual(calls.filter((c) => c.method === "PATCH")
  .map((c) => c.pathname), ["/v1/tags/t2"]);

// A failed page of tags stops the run rather than reading as no tags.
stub({...live}, {tags: [{id: "t1"}, {id: "t2"}], tagsFail: 2});
await assert.rejects(apply(tagged, client(tagged, "k"), quiet),
  /GET \/tags\?page=2/);

// A refused tag is reported, and a tag renamed under its id is matched by
// the id, not taken for a new tag.
const renamed = await loadSettings(repo({"buttondown/tags.json":
  JSON.stringify([{id: "t1", name: "Renamed"}])}));
live = {...NEWSLETTER, ...await buildPayload(renamed)};
calls = stub(live, {tags: [{id: "t1", name: "Old"}], refuseTags: true});
assert.deepEqual(await apply(renamed, client(renamed, "k"), quiet),
  {refused: ["tag Renamed"]});
assert.deepEqual(calls.filter((c) => c.method === "PATCH")
  .map((c) => c.pathname), ["/v1/tags/t1"]);

// Drafts: created with the id written back, replaced while a draft, and
// refused once sent; the front matter is checked first.
const draftDir = repo({"post.md": "# Hello\n\nBody.\n",
  "bad.md": "No subject\n", "empty.md": "---\nid:\n---\n# Hi\n"});
const emails = {em_new: {id: "em_new", status: "draft"}};
stub(current(), {emails});
await draft(settings, api(), join(draftDir, "post.md"), quiet);
assert.match(readFileSync(join(draftDir, "post.md"), "utf8"),
  /^---\nid: em_new\n---\n# Hello/);
await draft(settings, api(), join(draftDir, "post.md"), quiet);
assert.equal(emails.em_new.subject, "Hello");
emails.em_new.status = "sent";
await assert.rejects(draft(settings, api(), join(draftDir, "post.md"), quiet),
  /em_new is sent, not a draft/);
await assert.rejects(draft(settings, api(), join(draftDir, "bad.md"), quiet),
  /first line must be `# Subject`/);
await assert.rejects(draft(settings, api(), join(draftDir, "empty.md"), quiet),
  /empty `id:`/);

// The command fails when anything was refused, so a script can gate on it.
// Run as a process, with fetch stubbed by a preloaded module.
const cli = repo({
  key: "k",
  "stub.mjs": `globalThis.fetch = async (url, init) => new Response(
    JSON.stringify(init.method === "PATCH" ? {detail: "plan"}
      : {...${JSON.stringify(NEWSLETTER)}, name: "Old"}),
    {status: init.method === "PATCH" ? 400 : 200});`,
});
const bin = join(dirname(fileURLToPath(import.meta.url)), "buttondown.mjs");
const run = (...args) => {
  try {
    execFileSync(process.execPath, ["--import", "./stub.mjs", bin, ...args],
      {cwd: cli, stdio: "pipe", env: {...process.env,
        BUTTONDOWN_KEY_FILE: join(cli, "key")}});
    return 0;
  } catch (e) {
    return e.status;
  }
};
assert.equal(run("apply"), 1);
assert.equal(run("draft", "a.md", "b.md"), 2);

// The skins a site composes: the web base after its opening comments and
// imports and ahead of its rules; the email base with literal values and
// a hide for each piece of Buttondown's email chrome.
const {composeWebSkin, emailBaseCss} =
  await import("../buttondown/skins.mjs");
// A font request's URL holds semicolons, which must not end the @import.
const fontImport = "@import url('https://f.example/css?family=A:wght@400;700"
  + "&display=swap');";
const composed = composeWebSkin(
  `/* site */\n${fontImport}\n:root { --x: 1; }\n.site { a: b; }\n`);
assert.ok(composed.startsWith(`/* site */\n${fontImport}`));
assert.ok(composed.indexOf(".login-modal-content") < composed.indexOf(":root"));
const theme = {fonts: {body: "Sans", heading: "Serif"},
  colours: {page: "#ffffff", ink: "#222222", heading: "#123456"},
  leading: {body: "1.5", prose: "1.6"}};
const emailBase = emailBaseCss(theme);
assert.match(emailBase, /p, li \{ font-family: Sans !important; color: #222222/);
assert.ok(Object.keys(EMAIL_CHROME_HIDES).every((h) =>
  emailBase.includes(`${h} { display: none !important; }`)));
assert.throws(() => emailBaseCss({fonts: {body: "Sans"}}),
  /emailBaseCss needs theme.fonts.heading/);

// The composer reads past @charset and @layer, an upper-case @import, and
// a quoted bracket in a URL, as well as comments.
const prelude = '@charset "utf-8";\n@layer a, b;\n@IMPORT url("a).css");\n';
assert.ok(composeWebSkin(`${prelude}.site { a: b; }`)
  .startsWith(`${prelude}\n${"/* The rules every site"}`));

// A field composed from the base is what the check reads, and `tokens`
// rewrites the block in the file `webSkin` names.
const skins = new URL("../buttondown/skins.mjs", import.meta.url).href;
const composedFiles = {
  "buttondown/fields/web_css.css": undefined,
  "buttondown/skins/web.css": `${root}\n.a { color: #222; }\n`,
  "buttondown/fields/web_css.mjs": "import {readFileSync} from 'node:fs';\n"
    + `import {composeWebSkin} from '${skins}';\n`
    + "export default composeWebSkin(readFileSync(new URL("
    + "'../skins/web.css', import.meta.url), 'utf8'));\n",
};
// The roles the shared base reads, each mapped by the site.
const roles = ["font-heading", "heading", "action-bg", "action-ink",
  "action-weight", "dialog-bg", "focus", "leading"]
  .map((role) => [`--bd-${role}`, "inherit"]);
// And Buttondown's theme variables they read.
const themeVars = ["--color-background", "--color-foreground",
  "--font-family-sans"].map((name) => [name, "inherit"]);
const composedConfig = {webSkin: "buttondown/skins/web.css",
  extra: [["--radius", "0"], ...roles, ...themeVars]};
const composedRepo = repo({...composedFiles, "buttondown/skins/web.css":
  `${root.replace("#123456", "#222222")}\n.a { color: #222; }\n`},
composedConfig);
await writeTokens(await loadSettings(composedRepo));
assert.deepEqual(await runCheck(await loadSettings(composedRepo)), []);
// Without the roles, the shared base's declarations would be dropped.
await fails(composedFiles, /reads --bd-focus, which nothing declares/,
  {webSkin: "buttondown/skins/web.css"});
// So would its theme variables: the base reads --font-family-sans too.
await fails(composedFiles, /reads --font-family-sans, which nothing declares/,
  {webSkin: "buttondown/skins/web.css", extra: [["--radius", "0"], ...roles]});
await fails(web("@import url('late.css');"), /@import that is not a complete/);
await fails(web("@IMPORT url('late.css');"), /@import that is not a complete/);
// The cut-short URL a naive composer leaves: no rule precedes it, but it
// is not a whole statement, so the gate refuses it.
await fails({"buttondown/fields/web_css.css":
  "@import url('https://f.example/css?a=1;\n.x { a: b; }\n2');\n" + root},
  /@import that is not a complete/);
// "@import" inside a string is not an import.
assert.ok(!(await problems(web('.d::after { content: "@import"; }')))
  .some((p) => /@import/.test(p)));

// Every --bd-* role the skin reads must be declared.
await fails(web(".f { color: var(--bd-missing); }"),
  /reads --bd-missing, which nothing declares/);

// A payload with no skin to check is refused rather than passed.
await assert.rejects(problems({"buttondown/fields/css.css": undefined}),
  /the payload has no css field to check/);

// The email blocks: every option stated, the button keyed on its class,
// and a footer that must be told whether there is a subscription.
const {createEmailBlocks} = await import("../buttondown/email-blocks.mjs");
const blockOptions = {
  theme,
  colours: {titleGround: "#eee", action: "#123456", actionInk: "#000",
    footerGround: "#000", footerRule: "#333"},
  rhythm: {cardPadding: "32px 24px",
    buttonCell: "16px 0 32px 0", buttonSize: "16px",
    buttonPadding: "14px 20px", footerRuleWidth: "1px",
    footerCells: ["24px 24px 0 24px", "12px 24px 24px 24px"]},
  small: "font-size:13px;", buttonClass: "action",
  smallLink: (href, text) => `<a href="${href}">${text}</a>`,
  colophon: "Registered.", copyright: "&copy; Example",
  sentenceBreak: "<br>", signoff: "A. Writer",
};
const blocks = createEmailBlocks(blockOptions);
assert.match(blocks.button("https://example.com/", "Go"), /<a class="action"/);
assert.match(blocks.footer({subscription: true}),
  /Registered\.<br>You can <a href="\{\{ unsubscribe_url \}\}">/);
assert.ok(!blocks.footer({subscription: false}).includes("unsubscribe_url"));
assert.throws(() => blocks.footer(), /needs subscription: true or false/);
assert.match(blocks.signoff(), /A\. Writer/);
assert.throws(() => createEmailBlocks({...blockOptions, colophon: undefined}),
  /createEmailBlocks needs colophon/);
assert.throws(() => createEmailBlocks({...blockOptions,
  rhythm: {...blockOptions.rhythm, footerCells: ["1px"]}}),
/createEmailBlocks needs rhythm.footerCells.1/);
assert.throws(() => createEmailBlocks({...blockOptions, theme: {}}),
  /createEmailBlocks needs theme.fonts.body/);
assert.throws(() => createEmailBlocks(), /createEmailBlocks needs/);

// The public entry exports exactly what index.d.mts declares.
assert.deepEqual(Object.keys(await import("../buttondown/index.mjs")).sort(),
  ["EMAIL_CHROME_HIDES", "TABLE", "buildPayload", "composeWebSkin",
    "createEmailBlocks", "emailBaseCss", "loadSettings", "tokenReader"]);

console.log("buttondown tests OK");
