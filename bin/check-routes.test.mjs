#!/usr/bin/env node
// check-routes' one test: that it can fail. A check that has stopped
// catching anything prints the same tick as one that works, so this pins
// the failure path against a stub server, with no Next build.
import {strict as assert} from "node:assert";
import {createServer} from "node:http";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {failing, linkTarget, linkTargets, pageTarget} from "./check-routes.mjs";

const HOST = "127.0.0.1";

/** Each path's status; anything else is a 404. */
const ROUTES = {
  "/": 200, "/broken": 500, "/moved": 308, "/book": 307, "/gone": 307,
};
/** Where each redirect leads. */
const LOCATIONS = {"/moved": "/", "/book": "/", "/gone": "/nowhere"};

const server = createServer((req, res) => {
  const status = ROUTES[req.url] ?? 404;
  const location = LOCATIONS[req.url];
  res.writeHead(status, location ? {location} : {}).end();
});
await new Promise((resolve) => server.listen(0, HOST, resolve));
const base = `http://${HOST}:${server.address().port}`;

try {
  // A page must answer 200 where it is listed: a redirect fails it.
  const pages = await failing(
    ["/", "/broken", "/moved"].map((page) => pageTarget(base, page)),
  );
  assert.deepEqual(
    pages.map(({label, status}) => [label, status]).sort(),
    [["/broken", 500], ["/moved", 308]],
  );
  console.log("check-routes: fails each page that is not a 200");

  // A link counts where its redirects end: /book reaches a 200, /gone a 404.
  const links = await failing([
    {target: "/book", from: "routes.links"},
    {target: "/gone", from: "routes.links"},
    {target: `${base}/broken`, from: "tally form contact"},
  ].map((link) => linkTarget(base, link)));
  assert.deepEqual(
    links.map(({label, status}) => [label, status]).sort(),
    [["/gone  (routes.links)", 404], [`${base}/broken  (tally form contact)`, 500]],
  );
  console.log("check-routes: fails each link whose last answer is not a 200");

  // A link that is neither a site path nor an address names its config entry.
  assert.throws(
    () => linkTarget(base, {target: "book", from: "routes.links"}),
    /routes\.links: "book" is neither a site path nor an absolute address/,
  );
  assert.equal(
    linkTarget(base, {target: "//cal.example/x", from: "routes.links"}).url,
    "https://cal.example/x",
  );
  console.log("check-routes: names a link that is not an address");

  // The links come from routes.links and every id in the Tally registry.
  const dir = await mkdtemp(path.join(os.tmpdir(), "check-routes-"));
  try {
    await writeFile(path.join(dir, "forms.json"), JSON.stringify({contact: "AbC123"}));
    await writeFile(path.join(dir, "casomo.config.mjs"), "export default "
      + JSON.stringify({routes: {links: ["/book"]}, tally: {registry: "forms.json"}}));
    assert.deepEqual(await linkTargets(dir), [
      {target: "/book", from: "routes.links"},
      {target: "https://tally.so/r/AbC123", from: "tally form contact"},
    ]);
    console.log("check-routes: reads routes.links and the Tally registry");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
} catch (err) {
  console.error(`check-routes: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  server.close();
}
