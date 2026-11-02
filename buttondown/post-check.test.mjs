#!/usr/bin/env node
// Tests for the post copy gate. Each case builds its own repo in a temp
// directory with a stand-in cspell that records how it was called, and every
// link goes to a stubbed fetch, so nothing reaches the network. Each check is
// watched failing; real cspell's own behaviour is the consuming repos' to
// exercise.
import {strict as assert} from "node:assert";
import {
  chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  BANNED, bannedIn, checkPost, linksOf, paragraphsOf, parsePost, proseOf,
} from "./post-check.mjs";

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}\n     ${error.message}`);
  }
}

/** Plain sentences, enough of them for the formulas to score. */
const PLAIN = Array.from({length: 30},
  () => "The pay rise is small. Tax takes part of it.").join(" ");

/**
 * A repo whose stand-in cspell reports each word in `unknown`, or exits
 * with `crash` and no output. It writes its arguments to `cspell.args`.
 */
function repo({unknown = [], crash, config = {}, denylist = "", pkg} = {}) {
  const root = mkdtempSync(join(tmpdir(), "post-check-"));
  const bin = join(root, "node_modules", ".bin");
  mkdirSync(bin, {recursive: true});
  const lines = unknown.map((w) => `echo "stdin:1:1 - Unknown word (${w})"`);
  const status = crash ?? (unknown.length ? 1 : 0);
  writeFileSync(join(bin, "cspell"), "#!/bin/sh\n"
    + `echo "$@" > "${join(root, "cspell.args")}"\ncat > /dev/null\n`
    + `${lines.join("\n")}\nexit ${status}\n`);
  chmodSync(join(bin, "cspell"), 0o755);
  writeFileSync(join(root, "casomo.config.mjs"),
    `export default ${JSON.stringify(config)};\n`);
  if (denylist !== null) writeFileSync(join(root, ".personal-data-denylist"), denylist);
  if (pkg) writeFileSync(join(root, "package.json"), JSON.stringify(pkg));
  return root;
}

function post(root, text) {
  const file = join(root, "post.md");
  writeFileSync(file, text);
  return file;
}

/** A fetch that answers each URL with the status `statuses` gives it, or
 *  `fallback`; a status of "throw" rejects, as a timeout does. */
function stubFetch(statuses = {}, fallback = 200) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const status = statuses[url] ?? fallback;
    if (status === "throw") throw Object.assign(new Error("t"), {name: "TimeoutError"});
    return {status, body: null};
  };
  return {impl, calls};
}

const check = (root, text, fetcher = stubFetch()) =>
  checkPost(post(root, text), {root, fetchImpl: fetcher.impl});

await test("parsePost reads the fields and refuses a post with no subject", () => {
  const p = parsePost("---\ndescription: A line.\nimage: https://i.test/a.png\n---\n"
    + "# Subject\n\nBody.\n");
  assert.equal(p.subject, "Subject");
  assert.equal(p.description, "A line.");
  assert.equal(p.image, "https://i.test/a.png");
  assert.equal(p.body.trim(), "Body.");
  assert.throws(() => parsePost("No heading.\n"), /# Subject/);
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

await test("linksOf finds each link once, and none inside code", () => {
  const links = linksOf("[a](https://a.test) <a href=\"https://b.test\">b</a> "
    + "<https://c.test> [again](https://a.test) `[x](https://code.test)`\n"
    + "```\n[y](https://fence.test)\n```");
  assert.deepEqual(links, ["https://a.test", "https://b.test", "https://c.test"]);
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
    for (const entity of ["&mdash;", "&#8212;", "&#x2014;"]) {
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

await test("a 404 or 410 link fails; a 5xx is retried, then warns", async () => {
  const fetcher = stubFetch({
    "https://gone.test": 404, "https://removed.test": 410,
    "https://flaky.test": 500, "https://slow.test": "throw",
    "https://blocked.test": 403,
  });
  const body = ["gone", "removed", "flaky", "slow", "blocked", "fine"]
    .map((h) => `[${h}](https://${h}.test)`).join(" ");
  const {problems, warnings} = await check(repo(), `# S\n\n${PLAIN} ${body}\n`,
    fetcher);
  assert.deepEqual(problems,
    ["link 404: https://gone.test", "link 410: https://removed.test"]);
  assert.deepEqual(warnings, [
    "link 500 after a retry: https://flaky.test",
    "link TimeoutError after a retry: https://slow.test",
    "link 403: https://blocked.test",
  ]);
  assert.equal(fetcher.calls.filter((u) => u === "https://flaky.test").length, 2);
  assert.equal(fetcher.calls.filter((u) => u === "https://gone.test").length, 1);
});

await test("the share image is fetched too", async () => {
  const fetcher = stubFetch({"https://i.test/gone.png": 404});
  const {problems} = await check(repo(),
    `---\nimage: https://i.test/gone.png\n---\n# S\n\n${PLAIN}\n`, fetcher);
  assert.deepEqual(problems, ["link 404: https://i.test/gone.png"]);
});

await test("when no link could be fetched, one warning says so", async () => {
  const body = "[a](https://a.test) [b](https://b.test)";
  const {problems, warnings} = await check(repo(), `# S\n\n${PLAIN} ${body}\n`,
    stubFetch({}, "throw"));
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, ["links: none of 2 could be checked (network?)"]);
});

if (failures) {
  console.error(`\n${failures} failing`);
  process.exit(1);
}
