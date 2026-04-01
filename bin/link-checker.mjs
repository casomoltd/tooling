#!/usr/bin/env node

/**
 * Check links in a built Next.js site.
 *
 * Usage:
 *   link-checker [--pretty] [--timeout <ms>]
 *
 * Options:
 *   --pretty   Print a human-readable summary to stderr.
 *   --timeout  Request timeout in milliseconds (default: 10000).
 *
 * Per-repo config:
 *   Place a link-checker.config.mjs in the project root.
 *   Exports: skip (array of RegExp/string), timeout (number).
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
} from "../link-checker/index.mjs";

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  const {values} = parseArgs({
    options: {
      pretty: {type: "boolean", default: false},
      timeout: {type: "string"},
    },
  });

  const config = await loadConfig("link-checker.config.mjs");

  const timeout =
    values.timeout != null
      ? Number(values.timeout)
      : (config.timeout ?? DEFAULT_TIMEOUT);

  const skip = config.skip ?? [];

  const results = await checkLinks({skip, timeout});

  if (values.pretty) {
    console.error(formatPretty(results));
  }
  console.log(JSON.stringify(results, null, 2));

  process.exit(results.passed ? 0 : 1);
}

main();
