#!/usr/bin/env node
// Tests for the post copy gate's link check: each link's status, and each
// fragment looked up on its page. Every link goes to a stubbed fetch, so
// nothing reaches the network.
import {strict as assert} from "node:assert";
import {linksOf} from "./post-check.mjs";
import {PLAIN, check, finish, repo, stubFetch, test} from "./post-check.fixture.mjs";

await test("linksOf finds each link once, and none inside code", () => {
  const links = linksOf("[a](https://a.test) <a href=\"https://b.test\">b</a> "
    + "<https://c.test> [again](https://a.test) `[x](https://code.test)`\n"
    + "```\n[y](https://fence.test)\n```");
  assert.deepEqual(links, ["https://a.test", "https://b.test", "https://c.test"]);
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

/** A post whose body links to each of `links`, checked against `pages`. */
const linkCheck = (links, pages, statuses = {}) => {
  const fetcher = stubFetch(statuses, 200, pages);
  const body = links.map((url, i) => `[l${i}](${url})`).join(" ");
  return {fetcher, result: check(repo(), `# S\n\n${PLAIN} ${body}\n`, fetcher)};
};
const PAGE = "https://page.test/a";
const HTML = {html: "<h2 id=\"pay\">Pay</h2><p class=x id='tax'>Tax</p>"
  + "<a name=\"old\"></a><h3 id=\"band 5\">Band 5</h3><i id=\"a%20b\"></i>"
  + "<b id=\"q&amp;a\"></b><h2 id=\"user-content-install\">Install</h2>"};
const missed = (id, link) => `link fragment #${id} not on page: ${link}`;

await test("a fragment on the page passes, by id in either quote or a name",
  async () => {
    const {result} = linkCheck(
      [`${PAGE}#pay`, `${PAGE}#tax`, `${PAGE}#old`], {[PAGE]: HTML});
    const {problems, warnings} = await result;
    assert.deepEqual(problems, []);
    assert.deepEqual(warnings, []);
  });

await test("a fragment not on the page fails, naming the fragment and link",
  async () => {
    const {problems} = await linkCheck([`${PAGE}#gone`], {[PAGE]: HTML}).result;
    assert.deepEqual(problems, [missed("gone", `${PAGE}#gone`)]);
  });

await test("a fragment miss is not retried", async () => {
  const {fetcher, result} = linkCheck([`${PAGE}#gone`], {[PAGE]: HTML});
  await result;
  assert.deepEqual(fetcher.calls, [PAGE]);
});

await test("an id-like string outside a start tag's attributes is not an id",
  async () => {
    const decoys = {html: "<a href=\"/x?id=pay&name=tax\">x</a>"
      + "<script>{id = 5}</script><p>Set id=rates</p>"
      + "<img alt=\"see id=alt\"><button onclick=\"var id='click'\">b</button>"
      + "<img alt=\"<b id=inside>\">"};
    const links = ["pay", "tax", "5", "rates", "alt", "click", "inside"]
      .map((f) => `${PAGE}#${f}`);
    const {problems} = await linkCheck(links, {[PAGE]: decoys}).result;
    assert.deepEqual(problems, links.map((l) => missed(l.split("#")[1], l)));
  });

await test("an id after a quoted value holding id= or >, or with no space, is read",
  async () => {
    const tricky = {html: "<input value=\" id=v\" id=real>"
      + "<a title=\"x>y\" id=\"gt\">a</a><a href=\"x\"id=\"tight\">t</a>"};
    const {problems} = await linkCheck(
      [`${PAGE}#real`, `${PAGE}#gt`, `${PAGE}#tight`, `${PAGE}#v`],
      {[PAGE]: tricky}).result;
    assert.deepEqual(problems, [missed("v", `${PAGE}#v`)]);
  });

await test("a tag left open gives way to the next, whose id is read",
  async () => {
    const {problems} = await linkCheck([`${PAGE}#x`],
      {[PAGE]: {html: "<a foo <b id=x>"}}).result;
    assert.deepEqual(problems, []);
  });

await test("an attribute parted from the last by a slash is read", async () => {
  const slashed = {html: "<div/id=\"y\"></div><div id=\"x\" / >"};
  const {problems} = await linkCheck([`${PAGE}#y`, `${PAGE}#x`],
    {[PAGE]: slashed}).result;
  assert.deepEqual(problems, []);
});

await test("a fragment is looked up as written before it is decoded",
  async () => {
    const {problems} = await linkCheck([`${PAGE}#a%20b`], {[PAGE]: HTML}).result;
    assert.deepEqual(problems, []);
  });

await test("a percent-encoded fragment is decoded before it is looked up",
  async () => {
    const {problems} = await linkCheck([`${PAGE}#band%205`], {[PAGE]: HTML}).result;
    assert.deepEqual(problems, []);
  });

await test("an undecodable fragment is looked up as written", async () => {
  const link = `${PAGE}#%E0%A4%A`;
  const {problems} = await linkCheck([link], {[PAGE]: HTML}).result;
  assert.deepEqual(problems, [missed("%E0%A4%A", link)]);
});

await test("a named or numeric entity in an id is decoded", async () => {
  const page = {html: "<b id=\"q&amp;a\"></b><b id=\"it&#x27;s\"></b>"
    + "<b id=\"&#65;&apos;\"></b>"};
  const {problems} = await linkCheck(
    [`${PAGE}#q&a`, `${PAGE}#it's`, `${PAGE}#A'`], {[PAGE]: page}).result;
  assert.deepEqual(problems, []);
});

await test("a GitHub user-content- id matches the fragment without the prefix",
  async () => {
    const {problems} = await linkCheck([`${PAGE}#install`], {[PAGE]: HTML}).result;
    assert.deepEqual(problems, []);
  });

await test("text fragments, #top in any case, an empty # and hash routes are "
  + "not looked up", async () => {
  const skipped = ["#:~:text=Pay", "#top", "#TOP", "#%74op", "#", "#/route",
    "#!/route"];
  const {problems} = await linkCheck(skipped.map((f) => `${PAGE}${f}`),
    {[PAGE]: HTML}).result;
  assert.deepEqual(problems, []);
});

await test("the id before a text directive is still looked up", async () => {
  const link = `${PAGE}#gone:~:text=Pay`;
  const {problems} = await linkCheck([link], {[PAGE]: HTML}).result;
  assert.deepEqual(problems, [missed("gone", link)]);
});

await test("a fragment on a page that isn't HTML is not looked up", async () => {
  const pdf = "https://page.test/a.pdf";
  const {problems} = await linkCheck([`${pdf}#page=2`],
    {[pdf]: {type: "application/pdf", text: "%PDF"}}).result;
  assert.deepEqual(problems, []);
});

await test("a refused page with fragments warns and looks nothing up",
  async () => {
    const refused = "https://page.test/refused";
    const busy = "https://page.test/busy";
    const {problems, warnings} = await linkCheck(
      [`${refused}#pay`, `${refused}#tax`, `${busy}#pay`],
      {[refused]: {...HTML, status: 403}, [busy]: {...HTML, status: 429}}).result;
    assert.deepEqual(problems, []);
    assert.deepEqual(warnings,
      [`link 403: ${refused}`, `link 429: ${busy}#pay`]);
  });

await test("a fragment missing after a redirect to another page warns", async () => {
  const wall = "https://consent.test/wall";
  const link = `${PAGE}#gone`;
  const {problems, warnings} = await linkCheck([link],
    {[PAGE]: {...HTML, redirectedTo: wall}}).result;
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings,
    [`link fragment #gone not checked: ${link} redirected to ${wall}`]);
});

await test("a fragment missing after a redirect to the same page fails",
  async () => {
    for (const to of [`${PAGE}/`, PAGE.replace("https:", "http:"),
      PAGE.replace("//", "//www.")]) {
      const link = `${PAGE}#gone`;
      const {problems, warnings} = await linkCheck([link],
        {[PAGE]: {...HTML, redirectedTo: to}}).result;
      assert.deepEqual(problems, [missed("gone", link)], to);
      assert.deepEqual(warnings, [], to);
    }
  });

await test("two spellings of one page are each fetched", async () => {
  const loose = "http://www.page.test/a/";
  const {fetcher, result} = linkCheck([`${PAGE}#pay`, `${loose}#pay`],
    {[PAGE]: HTML, [loose]: HTML});
  const {problems} = await result;
  assert.deepEqual(problems, []);
  assert.deepEqual(fetcher.calls, [PAGE, loose]);
});

await test("a link's entities are read back; an autolink's are not", () => {
  assert.deepEqual(
    linksOf("<a href=\"https://x.test/p?a=1&amp;b=2#q&amp;a\">x</a> "
      + "[m](https://y.test/?a=1&amp;b=2) <https://z.test/?a=1&amp;b=2>"),
    ["https://y.test/?a=1&b=2", "https://x.test/p?a=1&b=2#q&a",
      "https://z.test/?a=1&amp;b=2"]);
});

await test("a Markdown link with a title is found, without its title", () => {
  assert.deepEqual(
    linksOf("[a](https://a.test \"T\") [b](https://b.test 't') "
      + "[c](https://c.test (t))"),
    ["https://a.test", "https://b.test", "https://c.test"]);
});

await test("a Markdown link may hold balanced brackets", () => {
  assert.deepEqual(
    linksOf("[w](https://en.wikipedia.org/wiki/Foo_(bar)) and "
      + "[t](https://en.wikipedia.org/wiki/Baz_(qux) \"T\")."),
    ["https://en.wikipedia.org/wiki/Foo_(bar)",
      "https://en.wikipedia.org/wiki/Baz_(qux)"]);
});

await test("a single-quoted href or src is found", () => {
  assert.deepEqual(
    linksOf("<a href='https://a.test'>a</a> <img src='https://b.test/i.png'>"),
    ["https://a.test", "https://b.test/i.png"]);
});

await test("a page linked by two fragments is fetched once", async () => {
  const {fetcher, result} = linkCheck(
    [`${PAGE}#pay`, `${PAGE}#gone`], {[PAGE]: HTML});
  const {problems} = await result;
  assert.deepEqual(fetcher.calls, [PAGE]);
  assert.deepEqual(problems, [missed("gone", `${PAGE}#gone`)]);
});

await test("a missing page linked by two fragments is reported once, by page",
  async () => {
    const missing = "https://page.test/missing";
    const {problems} = await linkCheck([`${missing}#a`, `${missing}#b`], {},
      {[missing]: 404}).result;
    assert.deepEqual(problems, [`link 404: ${missing}`]);
  });

finish();
