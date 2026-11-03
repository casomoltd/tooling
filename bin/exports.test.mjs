#!/usr/bin/env node
// Each public entry exports exactly the values its declaration names. A
// module beside its own .d.mts is skipped by the typecheck, which reads the
// declaration instead, so a value declared and never exported would compile
// for a consumer and be undefined at run time: only this test sees the gap.
import {strict as assert} from "node:assert";
import {readFile} from "node:fs/promises";

/** Every exported entry whose code sits beside a declaration of the same
 *  name, read from package.json so a new entry is covered as it is added. */
const pkgFile = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(await readFile(pkgFile, "utf8"));
const ENTRIES = Object.values(pkg.exports)
  .filter((e) => typeof e === "object" && e.types?.endsWith(".d.mts"))
  .map((e) => e.default.replace(/^\.\//, "").replace(/\.mjs$/, ""));

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

for (const entry of ENTRIES) {
  const dts = await readFile(new URL(`../${entry}.d.mts`, import.meta.url), "utf8");
  const mod = await import(new URL(`../${entry}.mjs`, import.meta.url).href);
  assert.deepEqual(
    Object.keys(mod).sort((a, b) => a.localeCompare(b)),
    declaredValues(dts),
    `${entry}.mjs exports what ${entry}.d.mts declares`,
  );
}

console.log("exports tests OK");
