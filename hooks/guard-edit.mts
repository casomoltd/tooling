#!/usr/bin/env node
// PreToolUse guard for Edit/Write: block changes that weaken type-checking
// rather than fixing the code. These are config/suppression edits that pass
// `tsc`/`pyright` precisely because they switch the check off — so nothing
// downstream catches them; the guard is the only gate. Generic (no
// repo-specific names); ships in the public tooling plugin.
import {isEntryPoint, runGuard} from "./lib/run.mts";
import {VERDICTS, type Rule, type ToolInput} from "./lib/rule.mts";

const pathOf = (input: ToolInput): string => String(input.file_path ?? "");
// Inbound text: Write carries `content`, Edit carries `new_string`.
const body = (input: ToolInput): string =>
  String(input.content ?? input.new_string ?? "");

export const RULES = [
  {
    id: "tsconfig-strict-weakening",
    verdict: VERDICTS.Deny,
    reason:
      "Don't weaken TypeScript strictness — fix the code, not the config. " +
      "(strict:false / skipLibCheck:true / noImplicitAny:false)",
    matches: (i) => {
      if (!/tsconfig[^/]*\.json$/.test(pathOf(i))) return false;
      const c = body(i);
      return (
        /"strict"\s*:\s*false/.test(c) ||
        /"skipLibCheck"\s*:\s*true/.test(c) ||
        /"noImplicitAny"\s*:\s*false/.test(c)
      );
    },
  },
  // NB: `@ts-ignore`/`@ts-nocheck` are intentionally NOT guarded here — eslint's
  // `@typescript-eslint/ban-ts-comment` (in `npm run check`) owns them.
  {
    id: "py-type-ignore-blanket",
    verdict: VERDICTS.Deny,
    reason:
      "Don't blanket-ignore type errors (bare `# type: ignore`) — fix the " +
      "type, or scope it to a specific code: `# type: ignore[code]`.",
    matches: (i) => {
      if (!/\.pyi?$/.test(pathOf(i))) return false;
      // Only the blanket form (no `[code]`) is the smell.
      return /#\s*type:\s*ignore(?!\[)/.test(body(i));
    },
  },
] as const satisfies readonly Rule[];

/** The id of an Edit/Write rule, for a test case to name. */
export type EditRuleId = (typeof RULES)[number]["id"];

if (isEntryPoint(import.meta.url)) {
  runGuard(RULES);
}
