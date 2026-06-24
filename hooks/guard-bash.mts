#!/usr/bin/env node
// PreToolUse guard for Bash commands: generic git + npm discipline that no
// linter or CI step catches because it happens at the command line, not in a
// file. Verdicts:
//   ask  -> force a user confirmation dialog (push is never automatic)
//   deny -> hard block (destructive/irreversible or needs human authorisation)
// Everything else falls through untouched. Contains no repo-specific names —
// this ships in the public tooling plugin.
import {pathToFileURL} from "node:url";
import {runGuard} from "./lib/run.mts";
import type {Rule, ToolInput} from "./lib/rule.mts";

const text = (input: ToolInput): string => String(input.command ?? "");

// git history + remote safety.
const gitRules: readonly Rule[] = [
  {
    id: "git-push-confirm",
    verdict: "ask",
    reason:
      "git push is never automatic — confirm it's intended. " +
      "Prefer `git push --follow-tags` so annotated version tags ship too.",
    matches: (i) => /\bgit\s+push\b/.test(text(i)),
  },
  {
    id: "git-force-push",
    verdict: "deny",
    reason:
      "Force-pushing rewrites published history. Blocked — if a remote " +
      "rewrite is genuinely required, ask the user to run it themselves.",
    matches: (i) => {
      const c = text(i);
      if (!/\bgit\s+push\b/.test(c)) return false;
      return (
        /--force(?!-with-lease)\b/.test(c) ||
        /(^|\s)-f(\s|$)/.test(c) ||
        /\bgit\s+push\b[^\n]*\s\+\S+/.test(c) // force refspec, e.g. `+main`
      );
    },
  },
  {
    id: "git-reset-hard",
    verdict: "deny",
    reason: "`git reset --hard` discards work irrecoverably. Blocked.",
    matches: (i) => /\bgit\s+reset\b[^\n]*--hard\b/.test(text(i)),
  },
  {
    id: "git-rebase-interactive",
    verdict: "deny",
    reason: "Interactive rebase rewrites history. Blocked.",
    matches: (i) =>
      /\bgit\s+rebase\b[^\n]*(\s-i\b|--interactive\b)/.test(text(i)),
  },
  {
    id: "git-tag-delete",
    verdict: "deny",
    reason: "Deleting tags can desync published versions. Blocked.",
    matches: (i) => /\bgit\s+tag\b[^\n]*(\s-d\b|--delete\b)/.test(text(i)),
  },
  {
    id: "git-filter-branch",
    verdict: "deny",
    reason: "`git filter-branch` rewrites entire history. Blocked.",
    matches: (i) => /\bgit\s+filter-branch\b/.test(text(i)),
  },
];

// npm/uv package + version discipline.
const packageRules: readonly Rule[] = [
  {
    id: "version-major",
    verdict: "deny",
    reason:
      "Major version bumps need explicit human approval — never automatic. " +
      "Use patch/minor, or ask the user to authorise the major bump.",
    matches: (i) => {
      const c = text(i);
      return (
        /\bnpm\s+version\s+major\b/.test(c) ||
        /\buv\s+version\b[^\n]*--bump\s+major\b/.test(c)
      );
    },
  },
  {
    id: "npm-global-install",
    verdict: "deny",
    reason:
      "Global installs are forbidden — project-local only " +
      "(`npm i` / `npm i -D`).",
    matches: (i) =>
      /\bnpm\s+(i|install|add)\b[^\n]*(\s-g\b|--global\b)/.test(text(i)),
  },
];

// One flat registry per Bash invocation, composed from the topical groups.
// NB: AI-attribution in commit messages is intentionally NOT guarded here —
// commitlint's `no-ai-attribution` (the commit-msg git hook) owns it, for every
// committer, not just a Claude session.
export const RULES: readonly Rule[] = [...gitRules, ...packageRules];

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGuard(RULES);
}
