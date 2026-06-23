#!/usr/bin/env node
// Hard leak-gate: assert the files a consumer would receive (via the
// `files` allowlist, on publish OR git-dependency install) never escape
// the allowlist and never look like a secret. Defence-in-depth on top of
// package.json "files" — this fails CI if that allowlist is ever loosened
// or a secret-bearing file sneaks in. The tooling repo is public, so the
// published/installed surface must stay configs + CLI only.
import {execSync} from "node:child_process";

// Dirs/files a consumer is allowed to receive. npm always adds
// package.json + LICENSE regardless of the allowlist, so permit those too.
const ALLOWED_PREFIXES = [
  "bin/",
  "eslint/",
  "prettier/",
  "commitlint/",
  "knip/",
  "jscpd/",
  "readability/",
];
const ALLOWED_FILES = ["README.md", "package.json", "LICENSE", "LICENSE.md"];

// Anything matching these must never ship, even from an allowed dir.
const SECRET_PATTERN =
  /(^|\/)(\.env(\..*)?|.*settings\.local\.json|.*\.pem|id_[rd]sa|.*\.key|\.npmrc)$/i;

const raw = execSync("npm pack --dry-run --json", {encoding: "utf8"});
const files = JSON.parse(raw)[0].files.map((entry) => entry.path);

const escaped = files.filter(
  (f) =>
    !ALLOWED_FILES.includes(f) &&
    !ALLOWED_PREFIXES.some((prefix) => f.startsWith(prefix)),
);
const secrets = files.filter((f) => SECRET_PATTERN.test(f));

if (escaped.length || secrets.length) {
  if (escaped.length) {
    console.error("✖ files outside the allowlist:\n  " + escaped.join("\n  "));
  }
  if (secrets.length) {
    console.error("✖ secret-like files in package:\n  " + secrets.join("\n  "));
  }
  process.exit(1);
}

console.log(`verify-pack OK — ${files.length} files, all within allowlist`);
