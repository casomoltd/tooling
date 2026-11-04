#!/usr/bin/env node
/**
 * Request every page a built Next.js site lists in its sitemap from
 * `next start` on a local port, and fail if any answers anything but 200.
 *
 * A build can pass while a page still fails at request time: a server
 * component that throws, or a fetch that breaks only when the page renders.
 * The pre-push hook runs this after `npm run check`, against the build
 * `check` has just made; it makes no build of its own. It stays out of
 * `check` because the pre-commit hook runs `check`, and starting a server
 * belongs to a push, not to every commit.
 *
 * It reads the sitemap Next emits: plain `<loc>` elements, in a urlset or a
 * sitemap index one level deep, with `&amp;` the only entity in a URL.
 *
 * It then follows the links a site promises will work wherever they were
 * sent, through their redirects, and fails unless the final response is a
 * 200: every entry in `routes.links` of casomo.config.mjs (an address in an
 * email signature that redirects to a booking page, say), and every form in
 * the Tally id registry `tally.registry` names, at tally.so/r/<id>, so a
 * form deleted in Tally fails the push. A path's first request goes to the
 * local server; where it redirects, the check follows to wherever that is,
 * the live site included. A registered form must answer publicly, so a draft
 * not yet published fails the push too. A page that has gone but still
 * answers 200 passes; the check sees statuses, not content.
 *
 * Usage, in the site's root after `next build`:
 *   check-routes
 *
 * Exit codes:
 *   0  every listed page and link answered 200
 *   1  one did not, the sitemap failed or listed none, the config could not
 *      be read, or the server never started
 */

import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {createServer} from "node:net";
import {setTimeout as sleep} from "node:timers/promises";
import path from "node:path";
import {tallyFormHref} from "../tally/event-reader.mjs";
import {formRegistry} from "../tally/config.mjs";
import {CASOMO_CONFIG_KEYS, isEntryPoint, loadCasomoConfig} from "./utils.mjs";

const HOST = "127.0.0.1";
const SITEMAP = "/sitemap.xml";
// The default distDir; a site that moves it is not supported.
const BUILD_ID = ".next/BUILD_ID";
// The site's own `next`, never one `npx` would offer to download.
const NEXT_BIN = "node_modules/.bin/next";
const HTTP_OK = 200;
const READY_POLL_MS = 250;
const READY_TIMEOUT_MS = 60_000;
// A page waiting on a dead upstream must fail the push, not hang it.
const REQUEST_TIMEOUT_MS = 30_000;
// Enough to keep a few hundred pages quick without starving the server.
const CONCURRENCY = 8;

/**
 * Something the check requests: its address, how the report names it, and
 * whether a redirect is followed. A sitemap page is not: it should be listed
 * where it lives. A promised link is, to its end.
 * @typedef {{url: string, label: string, follow: boolean}} Target
 */

/** A sitemap path on the local server.
 *  @param {string} base @param {string} path @returns {Target} */
export const pageTarget = (base, path) => ({
  url: base + path, label: path, follow: false,
});

/** A promised link, a site path from the local server and any other address
 *  as written (a protocol-relative one over https), followed to its end; a
 *  link that is neither is a mistake in the config, named as one.
 *  @param {string} base @param {{target: string, from: string}} link
 *  @returns {Target} */
export const linkTarget = (base, {target, from}) => {
  const local = target.startsWith("/") && !target.startsWith("//");
  const address = target.startsWith("//") ? `https:${target}` : target;
  if (!local && !URL.canParse(address)) {
    throw new Error(
      `${from}: "${target}" is neither a site path nor an absolute address`,
    );
  }
  const url = local ? base + target : new URL(address).href;
  return {url, label: `${target}  (${from})`, follow: true};
};

/** Request every target, CONCURRENCY at a time; return the ones whose final
 *  answer is not 200, each with its status or the error that stopped it.
 *  @param {Target[]} targets */
export const failing = async (targets) => {
  const queue = [...targets];
  const failures = [];
  const worker = async () => {
    for (let target = queue.shift(); target; target = queue.shift()) {
      const result = await probe(target);
      if (result.status !== HTTP_OK) failures.push(result);
    }
  };
  await Promise.all(Array.from({length: CONCURRENCY}, worker));
  return failures;
};

/**
 * Every link the site's config promises: its `routes.links`, then each form
 * in its Tally registry at its public address. Each is `{target, from}`, the
 * address and where it was named, for the report.
 * @param {string} [dir]
 * @returns {Promise<{target: string, from: string}[]>}
 */
export const linkTargets = async (dir = process.cwd()) => {
  const routes = await loadCasomoConfig(CASOMO_CONFIG_KEYS.routes, dir);
  const tally = await loadCasomoConfig(CASOMO_CONFIG_KEYS.tally, dir);
  const links = (routes.links ?? []).map((target) => ({
    target, from: "routes.links",
  }));
  if (!tally.registry) return links;
  const ids = await formRegistry(path.resolve(dir, tally.registry)).ids();
  return [
    ...links,
    ...Object.entries(ids).map(([key, id]) => ({
      target: tallyFormHref(id), from: `tally form ${key}`,
    })),
  ];
};

/** The path and query of every `<loc>` in a sitemap or sitemap index. The
 * sitemap names the production host; the check asks the local server. */
const sitemapPaths = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    const url = new URL(loc.trim().replaceAll("&amp;", "&"));
    return url.pathname + url.search;
  });

/** A sitemap index lists other sitemaps, not pages. */
const isSitemapIndex = (xml) => /<sitemapindex[\s>]/.test(xml);

const message = (err) => (err instanceof Error ? err.message : String(err));

const get = (url, init = {}) =>
  fetch(url, {...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)});

/** A sitemap's text; any answer but 200 is the failure, not a retry. */
const readSitemap = async (base, path) => {
  const res = await get(base + path);
  if (res.status !== HTTP_OK) throw new Error(`${path} answered ${res.status}`);
  return res.text();
};

/** Every page path, once each, following a sitemap index one level down. */
const collectPaths = async (base, rootXml) => {
  if (!isSitemapIndex(rootXml)) return [...new Set(sitemapPaths(rootXml))];
  const children = await Promise.all(
    sitemapPaths(rootXml).map((path) => readSitemap(base, path)),
  );
  return [...new Set(children.flatMap(sitemapPaths))];
};

/** One target's final status, or the error that stopped the request.
 *  @param {Target} target */
const probe = async ({url, label, follow}) => {
  try {
    const res = await get(url, {redirect: follow ? "follow" : "manual"});
    await res.arrayBuffer();
    return {label, status: res.status};
  } catch (err) {
    return {label, error: message(err)};
  }
};

/** A free local port, so a dev server already on 3000 is never in the way. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const listener = createServer();
    listener.on("error", reject);
    listener.listen(0, HOST, () => {
      const {port} = listener.address();
      listener.close(() => resolve(port));
    });
  });

/** `next start` in its own process group, so the stop reaches `next-server`
 * and not only its launcher. `died` rejects the moment the server fails to
 * spawn or exits, so a dead server fails the check now, not at the timeout. */
const startServer = (port) => {
  const server = spawn(NEXT_BIN, ["start", "-p", String(port), "-H", HOST], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const output = [];
  server.stdout.on("data", (d) => output.push(String(d)));
  server.stderr.on("data", (d) => output.push(String(d)));
  const died = new Promise((_, reject) => {
    server.on("error", (err) => reject(new Error(`could not start next: ${err}`)));
    server.on("exit", (code) =>
      reject(new Error(`next start exited (${code})\n${output.join("")}`)),
    );
  });
  // The exit the stop itself causes is expected, so nothing awaits it then.
  died.catch(() => {});
  return {server, output, died};
};

/** Stop the server's process group; one that has already exited is fine. */
const stopServer = (server) => {
  if (server.pid === undefined) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch (err) {
    if (err?.code !== "ESRCH") throw err;
  }
};

/** The root sitemap once the server answers; keep polling only while the
 * connection is refused. */
const waitForSitemap = async (base, output) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      return await readSitemap(base, SITEMAP);
    } catch (err) {
      if (!(err instanceof TypeError)) throw err;
    }
    await sleep(READY_POLL_MS);
  }
  throw new Error(`the server never answered ${SITEMAP}\n${output.join("")}`);
};

/** The verdict on the pages and links, printed; the exit code. */
const report = (pages, links, failures) => {
  if (pages === 0) {
    console.error(`✗ check-routes: ${SITEMAP} lists no pages`);
    return 1;
  }
  if (failures.length > 0) {
    console.error(
      `✗ check-routes: ${failures.length} of ${pages + links} failed`
        + ` (${pages} pages, ${links} links)`,
    );
    for (const {label, status, error} of failures) {
      console.error(`  ${status ?? error}  ${label}`);
    }
    return 1;
  }
  console.log(`✓ check-routes: ${pages} pages and ${links} links answered 200`);
  return 0;
};

/** Start the server, check every page and link, stop it; the exit code. */
const run = async () => {
  let links;
  try {
    links = await linkTargets();
  } catch (err) {
    console.error(`✗ check-routes: ${message(err)}`);
    return 1;
  }
  const port = await freePort();
  const base = `http://${HOST}:${port}`;
  const {server, output, died} = startServer(port);
  try {
    const rootXml = await Promise.race([waitForSitemap(base, output), died]);
    const paths = await collectPaths(base, rootXml);
    const failures = await failing([
      ...paths.map((page) => pageTarget(base, page)),
      ...links.map((link) => linkTarget(base, link)),
    ]);
    return report(paths.length, links.length, failures);
  } catch (err) {
    console.error(`✗ check-routes: ${message(err)}`);
    return 1;
  } finally {
    stopServer(server);
  }
};

const main = async () => {
  if (!existsSync(BUILD_ID)) {
    console.error(
      `✗ check-routes: no ${BUILD_ID}; run \`next build\` first`
        + " (a custom distDir is not supported)",
    );
    process.exit(1);
  }
  const code = await run();
  // The server's pipes can keep node alive past the stop; the check is done.
  process.exit(code);
};

if (isEntryPoint(import.meta.url)) await main();
