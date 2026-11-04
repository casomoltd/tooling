#!/usr/bin/env node
// PreToolUse guard for Bash commands: generic git, npm and uv discipline that no
// linter or CI step catches because it happens at the command line, not in a
// file. Verdicts:
//   ask  -> force a user confirmation dialog (push is never automatic)
//   deny -> hard block (destructive/irreversible or needs human authorisation)
// Everything else falls through untouched. Contains no repo-specific names —
// this ships in the public tooling plugin.
//
// Every rule searches the whole command text, so a command is caught however
// it is wrapped: behind `sudo`, an env prefix, a subshell or `bash -c`. A
// mention inside an argument is caught too, which errs towards caution. git
// takes no option before its verb (`cd <dir> && git <verb>` instead), since
// `git -C <dir> push` would put a word between the two a rule looks for.
import {commitDetail} from "./lib/commit-detail.mts";
import {isEntryPoint, runGuard} from "./lib/run.mts";
import {VERDICTS, type Rule, type ToolInput} from "./lib/rule.mts";
import {COMMIT_FORM, isSweepCommand, matchCommitForm} from "./lib/command-shapes.mjs";

/** `git` as a word of its own: not the end of `.git` or `my-git`. */
const GIT = String.raw`(?<![\w.-])git`;

/** A flag after a verb and, where it takes one, its value: a word or a
 *  quoted string, as in `version -m "Release" major`. */
const FLAG = String.raw`\s+-\S+(?:\s+(?:"[^"]*"|'[^']*'|[^-\s]\S*))?`;

/** The bump levels a release takes, and those that need a person's say. */
const MAJOR = "(?:pre)?major";
const PATCH_OR_MINOR = "(?:pre)?(?:patch|minor)";

/** npm's install verb, in each spelling npm accepts. */
const NPM_INSTALL = `(?:${[
  "i", "in", "ins", "inst", "insta", "instal", "install",
  "isnt", "isnta", "isntal", "isntall", "add", "it", "install-test",
].join("|")})`;

// git history + remote safety.
const gitRules = [
  {
    id: "git-commit-form",
    verdict: VERDICTS.Deny,
    reason:
      `Commit in the one form, run alone: \`${COMMIT_FORM}\`, after staging by `
      + "name and running the commit-msg hook on the file (the tooling "
      + "package's docs/commit.md).",
    // The one form is the commit whose prompt can show what it holds; the
    // sweep's own commit is the other form allowed.
    matches: (i) =>
      gitRuns(i, "commit") && !matchCommitForm(text(i)) && !isSweep(i),
  },
  {
    id: "git-commit-confirm",
    verdict: VERDICTS.Ask,
    reason:
      "Committing is deliberate, not automatic — stage and review first, then " +
      "confirm this commit is intended before it lands.",
    // The command alone shows neither what the commit holds nor its message,
    // so the detail shows both.
    matches: (i) => !isSweep(i) && matchCommitForm(text(i)) !== undefined,
    detail: (i) => {
      const commit = matchCommitForm(text(i));
      if (!commit) throw new Error("not a commit in the form");
      return commitDetail(commit);
    },
  },
  {
    id: "git-push-confirm",
    verdict: VERDICTS.Ask,
    reason:
      "git push is never automatic — confirm it's intended. " +
      "Prefer `git push --follow-tags` so annotated version tags ship too.",
    matches: (i) => !isSweep(i) && gitRuns(i, "push"),
  },
  {
    id: "git-force-push",
    verdict: VERDICTS.Deny,
    reason:
      "Force-pushing rewrites published history. Blocked — if a remote " +
      "rewrite is genuinely required, ask the user to run it themselves.",
    // `--force` (not the lease form), `-f`, or a `+` refspec such as `+main`.
    matches: (i) => gitRuns(i, "push", String.raw`[^\n]*(?:--force(?!-with-lease)\b`
      + String.raw`|${shortFlag("f")}|\s\+\S)`),
  },
  {
    id: "git-reset-hard",
    verdict: VERDICTS.Deny,
    reason: "`git reset --hard` discards work irrecoverably. Blocked.",
    matches: (i) => gitRuns(i, "reset", String.raw`[^\n]*--hard\b`),
  },
  {
    id: "git-rebase-interactive",
    verdict: VERDICTS.Deny,
    reason: "Interactive rebase rewrites history. Blocked.",
    matches: (i) =>
      gitRuns(i, "rebase", String.raw`[^\n]*(?:${shortFlag("i")}|--interactive\b)`),
  },
  {
    id: "git-tag-delete",
    verdict: VERDICTS.Deny,
    reason: "Deleting tags can desync published versions. Blocked.",
    matches: (i) =>
      gitRuns(i, "tag", String.raw`[^\n]*(?:${shortFlag("d")}|--delete\b)`),
  },
  {
    id: "git-filter-branch",
    verdict: VERDICTS.Deny,
    reason: "`git filter-branch` rewrites entire history. Blocked.",
    matches: (i) => gitRuns(i, "filter-branch"),
  },
  // Last of the git denies, so a rule naming what the command does wins the
  // tie and this one fires only where none does.
  {
    id: "git-option-before-verb",
    verdict: VERDICTS.Deny,
    reason:
      "Run git from its repo, `cd <dir> && git <verb> …`, not with an option "
      + "before the verb (`git -C <dir> …`): the guards read the verb as the "
      + "word after `git`.",
    matches: (i) => new RegExp(String.raw`${GIT}\s+-`).test(text(i)),
  },
] as const satisfies readonly Rule[];

// npm/uv package + version discipline.
const packageRules = [
  {
    id: "version-major",
    verdict: VERDICTS.Deny,
    reason:
      "Major version bumps need explicit human approval — never automatic. " +
      "Use patch/minor, or ask the user to authorise the major bump.",
    matches: (i) => bumps(i, MAJOR),
  },
  {
    id: "version-bump-confirm",
    verdict: VERDICTS.Ask,
    reason:
      "A version bump is the release tail, not a mid-work step — confirm you're " +
      "shipping now. Bump once, right before the push that publishes/deploys.",
    // patch/minor only; major is denied above, a bare `npm version` just prints.
    matches: (i) => bumps(i, PATCH_OR_MINOR),
  },
  {
    id: "npm-global-install",
    verdict: VERDICTS.Deny,
    reason:
      "Global installs are forbidden — project-local only " +
      "(`npm i` / `npm i -D`).",
    // Global by a flag before or after the verb (`-g`, bundled or quoted,
    // `--global`, `--location=global`) or by npm's own environment setting.
    matches: (i) =>
      new RegExp(String.raw`\bnpm\b[^\n]*\s${NPM_INSTALL}(?:\s|$)`).test(text(i))
      && (new RegExp(String.raw`\bnpm\b[^\n]*(?:${shortFlag("g")}|--global\b`
        + String.raw`|--location[\s=]global\b)`).test(text(i))
        || /\bnpm_config_global=true\b/i.test(text(i))),
  },
] as const satisfies readonly Rule[];

// One flat registry per Bash invocation, composed from the topical groups.
// NB: AI-attribution in commit messages is intentionally NOT guarded here —
// commitlint's `no-ai-attribution` (the commit-msg git hook) owns it, for every
// committer, not just a Claude session.
export const RULES = [...gitRules, ...packageRules] as const;

/** The id of a Bash rule, for a test case to name. */
export type BashRuleId = (typeof RULES)[number]["id"];

/** The command's text, a line continuation read as the space it stands for. */
function text(input: ToolInput): string {
  return String(input.command ?? "").replaceAll(/\\\r?\n/g, " ");
}

/** An unattended dependency sweep's own commit and branch push
 *  (lib/command-shapes.mjs): the confirmations step aside for them and the
 *  commit form allows them; every other `deny` stays absolute. */
function isSweep(input: ToolInput): boolean {
  return isSweepCommand(text(input));
}

/** A short flag with this letter, alone, bundled or quoted: `-f`, `-uf`,
 *  `'-f'`. */
function shortFlag(letter: string): string {
  return String.raw`\s['"]?-[A-Za-z]*${letter}[A-Za-z]*\b`;
}

/** A word, quoted or not, and nothing more of it after. */
function word(pattern: string): string {
  return String.raw`['"]?${pattern}['"]?(?![\w-])`;
}

/** Whether a command's text runs git with this verb, then these words
 *  somewhere after it on the same line. */
function gitRuns(input: ToolInput, verb: string, after = ""): boolean {
  return new RegExp(String.raw`${GIT}\s+${verb}(?![\w-])${after}`).test(text(input));
}

/** Whether a command's text runs `npm version` or `uv version` naming one of
 *  these bump levels, after any flags. */
function bumps(input: ToolInput, levels: string): boolean {
  const c = text(input);
  const level = word(levels);
  return new RegExp(String.raw`\bnpm\b[^\n]*\bversion(?:${FLAG})*\s+${level}`).test(c)
    || new RegExp(String.raw`\buv\b[^\n]*\bversion\b[^\n]*--bump[\s=]+${level}`)
      .test(c);
}

if (isEntryPoint(import.meta.url)) {
  runGuard(RULES);
}
