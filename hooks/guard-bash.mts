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

// An unattended dependency sweep is the one automation that must commit and
// push with nobody watching. It works inside a throwaway
// `worktrees/dep-sweep-*` checkout, on the `dep-sweep` branch, and never
// touches `main`. No human is present to answer an `ask`, so a confirm verdict
// there does not gate that sweep — it refuses the command outright and the
// whole branch-preparing half of the job dies. Hence the exemption below.
//
// It is whole-command strict — `cd <sweep worktree> && <one allowed action>`
// and nothing else — for two reasons: a compound tail must not be able to
// smuggle extra work in under the exemption, and a consumer whose settings
// allow-list Bash has nothing stricter standing behind this predicate, so it
// is the line rather than a hint to a prompt that would otherwise follow.
const SWEEP_PATH = String.raw`/worktrees/dep-sweep-[\w.-]+`;
const SWEEP_TARGET = String.raw`(?:"[^"]*${SWEEP_PATH}"|[^\s"]*${SWEEP_PATH})`;
const SWEEP_ACTIONS = [
  String.raw`git commit -F \S+`,
  String.raw`git push --force-with-lease -u origin dep-sweep`,
];
const SWEEP_COMMAND = new RegExp(
  String.raw`^cd\s+${SWEEP_TARGET}\s+&&\s+(?:${SWEEP_ACTIONS.join("|")})$`,
);

/** The sweep's own branch-side commands, which the `ask` rules step aside for.
 * Only those two rules consult it — every `deny` stays absolute. */
const isSweepCommand = (i: ToolInput): boolean =>
  SWEEP_COMMAND.test(text(i).trim());

// git history + remote safety.
const gitRules: readonly Rule[] = [
  {
    id: "git-commit-confirm",
    verdict: "ask",
    reason:
      "Committing is deliberate, not automatic — stage and review first, then " +
      "confirm this commit is intended before it lands.",
    // Not `commit-tree`/`commit-graph` (plumbing/maintenance, not a commit).
    // Allows git's pre-verb flags (`git -C <dir> commit` is still a commit).
    matches: (i) =>
      !isSweepCommand(i) &&
      /\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+|--[\w-]+(?:=\S+)?\s+)*commit\b(?!-)/.test(
        text(i),
      ),
  },
  {
    id: "git-push-confirm",
    verdict: "ask",
    reason:
      "git push is never automatic — confirm it's intended. " +
      "Prefer `git push --follow-tags` so annotated version tags ship too.",
    matches: (i) => !isSweepCommand(i) && /\bgit\s+push\b/.test(text(i)),
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
    id: "version-bump-confirm",
    verdict: "ask",
    reason:
      "A version bump is the release tail, not a mid-work step — confirm you're " +
      "shipping now. Bump once, right before the push that publishes/deploys.",
    // patch/minor only; major is denied above, a bare `npm version` just prints.
    matches: (i) => {
      const c = text(i);
      return (
        /\bnpm\s+version\s+(patch|minor)\b/.test(c) ||
        /\buv\s+version\b[^\n]*--bump\s+(patch|minor)\b/.test(c)
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
