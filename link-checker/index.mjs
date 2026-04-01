/**
 * Link checking for built Next.js sites.
 *
 * Wraps linkinator to crawl static build output and verify
 * both internal and external links. Designed to be called
 * from the CLI wrapper or programmatically.
 */

import {LinkChecker} from "linkinator";

export const DEFAULT_TIMEOUT = 10_000;
export const DEFAULT_CONCURRENCY = 10;

/**
 * Crawl a built site directory and check all links.
 *
 * @param {object} options
 * @param {string} [options.path=".next/"]
 *   Path to the build output directory.
 * @param {(string|RegExp)[]} [options.skip=[]]
 *   URL patterns to skip (bot-blockers, etc.).
 * @param {number} [options.concurrency=10]
 * @param {number} [options.timeout=10000]
 * @returns {Promise<{passed: boolean, broken: object[], ok: object[]}>}
 */
export async function checkLinks({
  path: sitePath = ".next/",
  skip = [],
  concurrency = DEFAULT_CONCURRENCY,
  timeout = DEFAULT_TIMEOUT,
} = {}) {
  const checker = new LinkChecker();

  const linksToSkip = skip.map((pattern) =>
    pattern instanceof RegExp ? pattern.source : pattern,
  );

  const result = await checker.check({
    path: sitePath,
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

// -----------------------------------------------------------------
// Pretty-print a human-readable summary
// -----------------------------------------------------------------

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
