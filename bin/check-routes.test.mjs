#!/usr/bin/env node
// check-routes' one test: that it can fail. A check that has stopped
// catching anything prints the same tick as one that works, so this pins
// the failure path against a stub server, with no Next build.
import {strict as assert} from "node:assert";
import {createServer} from "node:http";
import {failingPages} from "./check-routes.mjs";

const HOST = "127.0.0.1";

/** Each path's status; anything else is a 404. */
const ROUTES = {"/": 200, "/broken": 500, "/moved": 308};

const server = createServer((req, res) => {
  const status = ROUTES[req.url] ?? 404;
  res.writeHead(status, status === 308 ? {location: "/"} : {}).end();
});
await new Promise((resolve) => server.listen(0, HOST, resolve));
const base = `http://${HOST}:${server.address().port}`;

try {
  const failures = await failingPages(base, ["/", "/broken", "/moved"]);
  assert.deepEqual(
    failures.sort((a, b) => a.path.localeCompare(b.path)),
    [
      {path: "/broken", status: 500},
      {path: "/moved", status: 308},
    ],
  );
  console.log("check-routes: fails each page that is not a 200");
} catch (err) {
  console.error(`check-routes: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  server.close();
}
