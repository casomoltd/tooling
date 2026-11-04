/**
 * The command shapes the guards match on their exact form alone, and the
 * character class that keeps them exact: the one commit form, which the
 * confirmation reads, and an unattended dependency sweep's two commands, which
 * the confirmations step aside for. Both are `cd <dir> && <action>`, built
 * here from one template.
 *
 * Published through shapes.mjs as `@casomoltd/tooling/hooks/shapes`, so a
 * consuming repo's own hook imports the same shapes rather than re-spelling
 * them. Plain JS because Node strips TypeScript nowhere under `node_modules`;
 * the code lives here, where the typecheck reads it, since beside its
 * declaration TypeScript would skip it.
 */

/** @import {FormCommit} from "./shapes.d.mts" */

/** A character a path in a matched shape may hold: no `;`, `&`, `|`, `$`,
 *  quote, bracket or newline, any of which could carry a second command. */
export const PLAIN_PATH_CHAR = String.raw`[\w./@+-]`;

/** The one commit form, as it is written to a person. */
export const COMMIT_FORM = inDir(
  "<absolute repo path>", commitFrom("<absolute message file>"));

/** An absolute path of plain characters, captured. */
const ABSOLUTE = `(/${PLAIN_PATH_CHAR}*)`;

/** The form, whole: single-spaced, each path absolute and plain. */
const COMMIT_COMMAND = new RegExp(`^${inDir(ABSOLUTE, commitFrom(ABSOLUTE))}$`);

/** A sweep worktree's directory, as the dependency sweep creates it. */
const SWEEP_PATH = String.raw`/worktrees/dep-sweep-[\w.-]+`;

/** The worktree a sweep command runs in: plain characters, or the same plus
 *  a space when quoted. */
const SWEEP_TARGET =
  String.raw`(?:"[\w./@+ -]*${SWEEP_PATH}"|${PLAIN_PATH_CHAR}*${SWEEP_PATH})`;

/** The sweep's two branch-side actions, either one: its commit, and the push
 *  of its own branch. Its message file may be relative to the worktree,
 *  unlike the commit form's. */
const SWEEP_ACTION = `(?:${[
  commitFrom(`${PLAIN_PATH_CHAR}+`),
  "git push --force-with-lease -u origin dep-sweep",
].join("|")})`;

/** A sweep command, whole. Its gaps around `cd` and `&&` may be any run of
 *  whitespace: the sweep is a script, not a person following the form. */
const SWEEP_COMMAND = new RegExp(
  "^" + inDir(SWEEP_TARGET, SWEEP_ACTION, String.raw`\s+`) + "$",
);

/**
 * A command in the one commit form, read to its repo and message file, or
 * undefined for any other command.
 * @param {string} command
 * @returns {FormCommit | undefined}
 */
export function matchCommitForm(command) {
  const [, repo, messageFile] = COMMIT_COMMAND.exec(command.trim()) ?? [];
  return repo && messageFile ? {repo, messageFile} : undefined;
}

/**
 * Whether a command is one of an unattended dependency sweep's own two:
 * its commit, or the push of its `dep-sweep` branch, run inside a
 * `worktrees/dep-sweep-*` checkout. No one is present to confirm them, so
 * the guards' confirmations step aside for exactly these, whole-command
 * strict, so a compound tail can't ride in under them.
 * @param {string} command
 */
export function isSweepCommand(command) {
  return SWEEP_COMMAND.test(command.trim());
}

/** `cd <dir> && <action>`, its three gaps single spaces unless given.
 *  @param {string} dir @param {string} action @param {string} [gap] */
function inDir(dir, action, gap = " ") {
  return `cd${gap}${dir}${gap}&&${gap}${action}`;
}

/** A commit from a message file.  @param {string} file */
function commitFrom(file) {
  return `git commit -F ${file}`;
}
