#!/usr/bin/env node
// Each public entry exports exactly the values its declaration names. The
// declaration is hand-written and named apart from its code (TypeScript skips
// a module beside a declaration of its own name, so the code stays
// type-checked), so a value declared and never exported would compile for a
// consumer and be undefined at run time.
import {strict as assert} from "node:assert";
import {readFile} from "node:fs/promises";

/** Every exported entry with a hand-written declaration, as its code and its
 *  types, read from package.json so a new entry is covered as it is added. */
const pkgFile = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(await readFile(pkgFile, "utf8"));
const ENTRIES = Object.values(pkg.exports)
  .filter((e) => typeof e === "object" && e.types?.endsWith(".d.mts"))
  .map((e) => ({code: e.default, types: e.types}));

/** @param {string} dts */
function declaredValues(dts) {
  const names = new Set();
  for (const m of dts.matchAll(/^export (?:declare )?(?:const|function|class) (\w+)/gm)) {
    names.add(m[1]);
  }
  for (const m of dts.matchAll(/^export \{([^}]+)\} from/gm)) {
    for (const name of m[1].split(",")) names.add(name.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

for (const {code, types} of ENTRIES) {
  const dts = await readFile(new URL(types, pkgFile), "utf8");
  const mod = await import(new URL(code, pkgFile).href);
  assert.deepEqual(
    Object.keys(mod).sort((a, b) => a.localeCompare(b)),
    declaredValues(dts),
    `${code} exports what ${types} declares`,
  );
}

console.log("exports tests OK");
