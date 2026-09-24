#!/usr/bin/env node
// Tests for the shared gate config loader: each case writes its own
// casomo.config.mjs into a fresh directory, so none reads this repo's.
import {strict as assert} from "node:assert";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {loadCasomoConfig} from "./utils.mjs";

const repo = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "casomo-config-"));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, name), text);
  }
  return dir;
};

// A key present returns its settings; one absent, or no file, returns none.
const both = repo({"casomo.config.mjs":
  "export default {privateRefs: {visibility: 'public'}};"});
assert.deepEqual(await loadCasomoConfig("privateRefs", both), {visibility: "public"});
assert.deepEqual(await loadCasomoConfig("personalData", both), {});
assert.deepEqual(await loadCasomoConfig("privateRefs", repo({})), {});

// A key no gate reads is refused rather than read as no settings.
await assert.rejects(loadCasomoConfig("privateRefs", repo({"casomo.config.mjs":
  "export default {privateRef: {visibility: 'public'}};"})), /no gate reads/);

// A retired per-tool file is refused, naming where its settings go.
await assert.rejects(loadCasomoConfig("privateRefs", repo({
  "check-private-refs.config.mjs": "export default {visibility: 'public'};",
})), /move its settings under `privateRefs`/);

console.log("casomo-config tests OK");
