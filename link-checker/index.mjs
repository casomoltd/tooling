/**
 * Link checking for Next.js sites.
 *
 * Wraps linkinator to crawl a running dev/preview server and
 * verify both internal and external links. The server must
 * already be running — this tool does NOT start one.
 */

import {LinkChecker} from "linkinator";

export const DEFAULT_TIMEOUT = 10_000;
export const DEFAULT_CONCURRENCY = 10;
export const DEFAULT_ORIGIN = "http://localhost:3000";

/**
 * Crawl a running site and check all links.
 *
 * @param {object} options
 * @param {string} [options.origin="http://localhost:3000"]
 *   Base URL of the running server.
 * @param {(string|RegExp)[]} [options.skip=[]]
 *   URL patterns to skip (bot-blockers, etc.).
 * @param {number} [options.concurrency=10]
 * @param {number} [options.timeout=10000]
 * @returns {Promise<{
 *   passed: boolean,
 *   broken: object[],
 *   ok: object[],
 * }>}
 */
export async function checkLinks({
  origin = DEFAULT_ORIGIN,
  skip = [],
  concurrency = DEFAULT_CONCURRENCY,
  timeout = DEFAULT_TIMEOUT,
} = {}) {
  const checker = new LinkChecker();

  const linksToSkip = skip.map((pattern) =>
    pattern instanceof RegExp
      ? pattern.source
      : pattern,
  );

  const result = await checker.check({
    path: origin,
    recurse: true,
    concurrency,
    timeout,
    linksToSkip,
  });

  const broken = result.links
    .filter((l) => l.state === "BROKEN")
    .map((l) => ({
      url: l.url,
      status: l.status,
      parent: l.parent,
    }));

  const ok = result.links
    .filter((l) => l.state === "OK")
    .map((l) => ({
      url: l.url,
      status: l.status,
    }));

  return {passed: result.passed, broken, ok};
}

// Pretty-print a human-readable summary
export function formatPretty(results) {
  const lines = [];

  if (results.broken.length > 0) {
    lines.push("\nBROKEN LINKS");
    lines.push("─".repeat(60));
    for (const link of results.broken) {
      lines.push(`  ${link.status}  ${link.url}`);
      lines.push(`       ← ${link.parent}`);
    }
  }

  lines.push(
    `\n${results.ok.length} OK, ` +
      `${results.broken.length} broken | ` +
      `${results.passed ? "PASSED" : "FAILED"}`,
  );
  return lines.join("\n");
}
