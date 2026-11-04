/**
 * The commit form, `cd <repo> && git commit -F <file>`, matched whole so
 * the commit prompt can read the repo and message file it names, and the
 * character class that keeps the match exact.
 *
 * Its types are shapes.d.mts.
 */

/** @import {FormCommit} from "./shapes.d.mts" */

/** A character a path in a matched shape may hold: no `;`, `&`, `|`, `$`,
 *  quote, bracket or newline, any of which could carry a second command. */
export const PLAIN_PATH_CHAR = String.raw`[\w./@+-]`;

/** The commit form, as it is written to a person. */
export const COMMIT_FORM = inDir(
  "<absolute repo path>", commitFrom("<absolute message file>"));

/** An absolute path of plain characters, captured. */
const ABSOLUTE = `(/${PLAIN_PATH_CHAR}*)`;

/** The form, whole: single-spaced, each path absolute and plain. */
const COMMIT_COMMAND = new RegExp(`^${inDir(ABSOLUTE, commitFrom(ABSOLUTE))}$`);

/**
 * A command in the commit form, read to its repo and message file, or
 * undefined for any other command.
 * @param {string} command
 * @returns {FormCommit | undefined}
 */
export function matchCommitForm(command) {
  const [, repo, messageFile] = COMMIT_COMMAND.exec(command.trim()) ?? [];
  return repo && messageFile ? {repo, messageFile} : undefined;
}

/** `cd <dir> && <action>`, single-spaced.
 *  @param {string} dir @param {string} action */
function inDir(dir, action) {
  return `cd ${dir} && ${action}`;
}

/** A commit from a message file.  @param {string} file */
function commitFrom(file) {
  return `git commit -F ${file}`;
}
