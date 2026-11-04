#!/usr/bin/env node
// The retention periods. The company's own periods have no outside source
// to check them against, so each is held only to being a whole, positive
// count; Tally's backup window is held to Tally's statement. The
// hand-written declaration (index.d.mts) is held to the code, so a period
// declared and never exported fails the typecheck here.
import {strict as assert} from "node:assert";
import * as periods from "./periods.mjs";

/** @type {typeof import("./index.d.mts")} */
const declared = periods;

for (const [name, value] of Object.entries(declared)) {
  if (typeof value !== "number") continue;
  assert.ok(Number.isInteger(value) && value > 0, `${name} is a positive count`);
}

// The days tally.so/help/gdpr gives for its backups, read 6 Oct 2026.
const TALLY_STATED_BACKUP_DAYS = 90;
assert.equal(declared.TALLY_BACKUP_DAYS, TALLY_STATED_BACKUP_DAYS);
assert.equal(new URL(declared.TALLY_BACKUPS_URL).protocol, "https:");

console.log("retention tests OK");
