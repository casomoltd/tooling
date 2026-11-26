#!/usr/bin/env node
// Tests for where the Tally API key comes from: a per-account key file where
// the account has one, else the variable the settings name.
import {strict as assert} from "node:assert";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {tallyApiKey} from "./config.mjs";

const dir = mkdtempSync(join(tmpdir(), "tally-key-"));
const keyFile = join(dir, "tally.key");
const env = {TALLY_API_KEY: "from-env"};
/** @param {string | undefined} apiKeyFile */
const settings = (apiKeyFile) => ({apiKeyEnv: "TALLY_API_KEY", apiKeyFile});

// A key file wins over the variable, and its whitespace is not part of the key.
writeFileSync(keyFile, "from-file \r\n");
assert.equal(await tallyApiKey(settings(keyFile), env), "from-file");

// No file on this account, or none configured, is the variable.
assert.equal(await tallyApiKey(settings(join(dir, "absent")), env), "from-env");
assert.equal(await tallyApiKey(settings(undefined), env), "from-env");

// `~/` is the account's home, and a path against no root is refused.
process.env.HOME = dir;
assert.equal(await tallyApiKey(settings("~/tally.key"), env), "from-file");
await assert.rejects(tallyApiKey(settings("tally.key"), env), /must start with/);

// A file that exists but is empty is refused, not skipped for the variable.
writeFileSync(keyFile, "\n");
await assert.rejects(tallyApiKey(settings(keyFile), env), /is empty/);

// A path that cannot be read as a file is refused too.
await assert.rejects(tallyApiKey(settings(dir), env), {code: "EISDIR"});

// No key anywhere names what was looked for.
await assert.rejects(tallyApiKey(settings(join(dir, "absent")), {}),
  /absent and TALLY_API_KEY is not set/);
await assert.rejects(tallyApiKey(settings(undefined), {}),
  /^Error: TALLY_API_KEY is not set/);

rmSync(dir, {recursive: true});
console.log("tally config tests OK");
