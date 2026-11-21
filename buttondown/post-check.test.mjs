#!/usr/bin/env node
// Tests for the post copy gate, all but its links (post-check.links.test.mjs).
// Each case builds its own repo in a temp directory with a stand-in cspell
// that records how it was called. Each check is watched failing; real
// cspell's own behaviour is the consuming repos' to exercise.
import {strict as assert} from "node:assert";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {BANNED, bannedIn, checkPost} from "./post-check.mjs";
import {PLAIN, check, finish, repo, test} from "./post-check.fixture.mjs";
import {paragraphsOf, proseOf} from "../readability/markdown.mjs";
import {parsePost} from "./post.mjs";

await test("parsePost reads the fields and refuses a post with no subject", () => {
  const p = parsePost("---\ndescription: A line.\nimage: https://i.test/a.png\n---\n"
    + "# Subject\n\nBody.\n");
  assert.equal(p.subject, "Subject");
  assert.equal(p.fields.description, "A line.");
  assert.equal(p.fields.image, "https://i.test/a.png");
  assert.equal(p.body.trim(), "Body.");
  assert.throws(() => parsePost("No heading.\n"), /# Subject/);
});

await test("parsePost reads a quoted value without its quotes", () => {
  const description = (value) => parsePost(
    `---\ndescription: ${value}\n---\n# Subject\n\nBody.\n`).fields.description;
  assert.equal(description('"Factors: the 2026 set."'), "Factors: the 2026 set.");
  assert.equal(description("'It''s here.'"), "It's here.");
  assert.equal(description("Plain, unquoted."), "Plain, unquoted.");
  assert.throws(() => description('"Opened, never closed.'), /write the value unquoted/);
  assert.throws(() => description("\"Mixed.'"), /write the value unquoted/);
  assert.throws(() => description('"'), /write the value unquoted/);
  assert.throws(() => description('"A \\"quote\\"."'), /write the value unquoted/);
  assert.throws(() => description('"Band 5" is not "band 6"'), /write the value unquoted/);
  assert.throws(() => description("'It's'"), /write the value unquoted/);
});

await test("parsePost refuses the front matter `draft` would refuse", () => {
  const head = (fm) => `---\n${fm}\n---\n# Subject\n\nBody.\n`;
  assert.throws(() => parsePost(head("image:")), /empty `image:`/);
  assert.throws(() => parsePost(head("id:")), /empty `id:`/);
  assert.throws(() => parsePost(head("image: og.png")),
    /image must be an absolute URL/);
});

await test("checkPost refuses an empty `image:`, as draft does", async () => {
  const root = repo();
  await assert.rejects(check(root, `---\nimage:\n---\n# Subject\n\n${PLAIN}\n`),
    /empty `image:`/);
});

await test("checkPost refuses to guess the repo", async () => {
  await assert.rejects(checkPost("post.md", {}), /repo root/);
});

await test("proseOf keeps link text and drops URLs, code and tags", () => {
  const text = proseOf("See [the rates](https://x.test/a) and `code`.\n"
    + "<div class=\"casomo-callout\"><p>Kept</p></div> https://y.test/b");
  assert.match(text, /the rates/);
  assert.match(text, /Kept/);
  assert.doesNotMatch(text, /x\.test|y\.test|code|casomo-callout/);
});

await test("paragraphsOf leaves out headings, lists, captions and HTML", () => {
  const body = "## Heading\n\nA paragraph.\n\n- a list item\n\n*A caption.*\n\n"
    + "<figure>x</figure>\n\n| a | b |\n\n> quote\n\nAnother paragraph.";
  assert.equal(paragraphsOf(body), "A paragraph.\n\nAnother paragraph.");
});

await test("bannedIn matches whole words and phrases, either apostrophe", () => {
  assert.deepEqual(bannedIn("A solution. Reach out today."), ["solution", "reach out"]);
  assert.deepEqual(bannedIn("Let’s connect."), ["let's connect"]);
  assert.deepEqual(bannedIn("Dissolution is not a banned word."), []);
  assert.ok(BANNED.inContext.includes("leverage"));
});

await test("a clean post passes with no warnings", async () => {
  const {problems, warnings} = await check(repo(), `# A subject\n\n${PLAIN}\n`);
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
});

await test("readability over the ceiling fails; a short post only warns", async () => {
  const root = repo();
  const hardText = "Notwithstanding the aforementioned considerations, the "
    + "administrative reorganisation necessitated comprehensive "
    + "reconsideration of remuneration arrangements. ";
  const hard = await check(root, `# S\n\n${hardText.repeat(20)}\n`);
  assert.match(hard.problems.join(), /readability: grade/);
  const short = await check(root, "# S\n\nOne sentence.\n");
  assert.deepEqual(short.problems, []);
  assert.match(short.warnings.join(), /too few to score/);
});

await test("a caption does not count towards readability", async () => {
  const words = "Notwithstanding the aforementioned considerations, ";
  const {problems} = await check(repo(),
    `# S\n\n${PLAIN}\n\n*${words.repeat(40)}*\n`);
  assert.deepEqual(problems, []);
});

await test("an em dash fails as a character or an entity; an en dash passes",
  async () => {
    const root = repo();
    const message = (where) => `em dash in the ${where}: use a full stop, colon, `
      + "semicolon, comma or brackets";
    const character = await check(root,
      `---\ndescription: One — two.\n---\n# S\n\n${PLAIN} Bands 2–6.\n`);
    assert.deepEqual(character.problems, [message("description")]);
    for (const entity of ["&mdash;", "&#8212;", "&#x2014;", "&#08212;"]) {
      const {problems} = await check(root, `# S\n\n${PLAIN} One ${entity} two.\n`);
      assert.deepEqual(problems, [message("body")], entity);
    }
    const inCode = await check(root, `# S\n\n${PLAIN} \`a — b\`\n`);
    assert.deepEqual(inCode.problems, []);
  });

await test("a banned word fails", async () => {
  const {problems} = await check(repo(), `# S\n\n${PLAIN} An innovative tool.\n`);
  assert.deepEqual(problems, ["banned words: innovative"]);
});

await test("an unknown word fails, and cspell gets the spell script's config",
  async () => {
    const root = repo({unknown: ["Recieve"],
      pkg: {scripts: {spell: "cspell -c words.json \"src/**\""}}});
    writeFileSync(join(root, "words.json"), "{}");
    const {problems} = await check(root, `# S\n\n${PLAIN}\n`);
    assert.deepEqual(problems, ["spelling: Recieve"]);
    const args = readFileSync(join(root, "cspell.args"), "utf8");
    assert.ok(args.includes(`--config ${join(root, "words.json")}`), args);
    assert.match(args, /--language-id markdown stdin/);
  });

await test("cspell reads the subject, description and body, not the front matter",
  async () => {
    const root = repo();
    await check(root, "---\nid: em_6jhrgmha3w\ndescription: Notes on work.\n"
      + `image: https://example.com/og.png\n---\n# Subject line\n\n${PLAIN}\n`);
    const read = readFileSync(join(root, "cspell.stdin"), "utf8");
    assert.ok(!read.includes("em_6jhrgmha3w"), read);
    assert.ok(!read.includes("example.com/og.png"), read);
    for (const kept of ["Subject line", "Notes on work.", PLAIN]) {
      assert.ok(read.includes(kept), kept);
    }
  });

await test("without a named config, cspell gets the first one its search finds",
  async () => {
    const root = repo();
    writeFileSync(join(root, "cspell.json"), "{}");
    await check(root, `# S\n\n${PLAIN}\n`);
    const args = readFileSync(join(root, "cspell.args"), "utf8");
    assert.ok(args.includes(`--config ${join(root, "cspell.json")}`), args);
  });

await test("cspell failing, missing or misconfigured fails the post", async () => {
  const crashed = await check(repo({crash: 2}), `# S\n\n${PLAIN}\n`);
  assert.match(crashed.problems.join(), /spelling: cspell failed \(2\)/);
  const misnamed = await check(
    repo({pkg: {scripts: {spell: "cspell -c gone.json"}}}), `# S\n\n${PLAIN}\n`);
  assert.match(misnamed.problems.join(), /names gone\.json, which doesn't exist/);
  const bare = mkdtempSync(join(tmpdir(), "post-check-"));
  const none = await check(bare, `# S\n\n${PLAIN}\n`);
  assert.match(none.problems.join(), /cspell is not installed/);
});

await test("personal data fails, and a repo's allowEmail lets an address by",
  async () => {
    // Joined at run time, so this file holds no address for the repo's own
    // personal-data check to find.
    const address = ["jane.doe", "realmail.co.uk"].join("@");
    const text = `# S\n\n${PLAIN} Write to ${address} or a@example.com.\n`;
    const plain = await check(repo(), text);
    assert.deepEqual(plain.problems, ["personal data, line 3: email address"]);
    const root = repo();
    writeFileSync(join(root, "casomo.config.mjs"), "export default "
      + "{personalData: {allowEmail: [/@realmail\\.co\\.uk$/]}};\n");
    const allowed = await check(root, text);
    assert.deepEqual(allowed.problems, []);
  });

await test("a name on the denylist fails; no denylist warns", async () => {
  const listed = await check(repo({denylist: "Jane Example\n"}),
    `# S\n\n${PLAIN} Jane Example said so.\n`);
  assert.deepEqual(listed.problems,
    ["personal data, line 3: name on the local denylist"]);
  const unlisted = await check(repo({denylist: null}), `# S\n\n${PLAIN}\n`);
  assert.deepEqual(unlisted.warnings,
    ["personal data: no .personal-data-denylist; name checking off"]);
});

finish();
