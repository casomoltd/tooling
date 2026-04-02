#!/usr/bin/env node

/**
 * Check links on a running Next.js site.
 *
 * Requires a dev or production server to be running already
 * (e.g. `npm run dev` or `next start`). Exits non-zero if the
 * server is unreachable.
 *
 * Usage:
 *   link-checker [--pretty] [--timeout <ms>] [--origin <url>]
 *
 * Options:
 *   --pretty   Print a human-readable summary to stderr.
 *   --timeout  Request timeout in milliseconds (default: 10000).
 *   --origin   Base URL of the server (default: http://localhost:3000).
 *
 * Per-repo config:
 *   Place a link-checker.config.mjs in the project root.
 *   Exports: skip (array of RegExp/string), timeout (number),
 *            origin (string).
 *
 * Exit codes:
 *   0  All links pass
 *   1  One or more broken links found
 */

import {parseArgs} from "node:util";
import {loadConfig} from "./utils.mjs";
import {
  checkLinks,
  formatPretty,
  DEFAULT_TIMEOUT,
  DEFAULT_ORIGIN,
} from "../link-checker/index.mjs";

async function serverIsUp(origin) {
  try {
    await fetch(origin, {signal: AbortSignal.timeout(3000)});
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const {values} = parseArgs({
    options: {
      pretty: {type: "boolean", default: false},
      timeout: {type: "string"},
      origin: {type: "string"},
    },
  });

  const config = await loadConfig("link-checker.config.mjs");

  const origin =
    values.origin ?? config.origin ?? DEFAULT_ORIGIN;
  const timeout =
    values.timeout != null
      ? Number(values.timeout)
      : (config.timeout ?? DEFAULT_TIMEOUT);
  const skip = config.skip ?? [];

  if (!(await serverIsUp(origin))) {
    console.error(
      `link-checker: server not reachable at ${origin}\n` +
      `Start the dev server first (npm run dev).`,
    );
    process.exit(1);
  }

  const results = await checkLinks({origin, skip, timeout});

  if (values.pretty) {
    console.error(formatPretty(results));
  }
  console.log(JSON.stringify(results, null, 2));

  process.exit(results.passed ? 0 : 1);
}

main();
