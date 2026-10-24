#!/usr/bin/env node
/**
 * Refuse a commit that changes a file still listed in the repo's
 * `eslint-suppressions.json`, unless the message says why it is deferred.
 *
 * The house size limits are lint errors, and a file that already broke one
 * when the limit was switched on is listed there instead of failing. The
 * list only shrinks if touching a file is the moment it is tidied: tidy it
 * in its own commit (fix it, then `eslint --prune-suppressions`), and the
 * change that needed it follows. ESLint itself fails while a fixed file
 * keeps its entry, so a tidied file always comes off the list. A commit that
 * has to change a listed file anyway carries a trailer naming why, so the
 * deferral shows in `git log`:
 *
 *   Lint-deferred: a one-line hotfix; the tidy follows in its own commit
 *
 * What it reads, and what it assumes:
 *
 * - **The list as staged**, so the commit that tidies a file and drops its
 *   entry passes.
 * - **The files staged now**, renames counted under their old path too. An
 *   amend is checked on what it newly stages, not on the whole commit.
 * - **One list, at the repo root**, keyed by root-relative path, which is
 *   where ESLint writes it when run from the root. A list anywhere else
 *   fails the check rather than being silently missed.
 * - **No merge commits:** a merge carries changes each branch already
 *   committed and was checked for.
 *
 * Runs from the shared commit-msg hook, the first point the message exists.
 *
 * Usage:
 *   check-listed-files <commit-message-file>
 */
import {execFileSync} from "node:child_process";
import {readFileSync, realpathSync} from "node:fs";
import {pathToFileURL} from "node:url";

/** ESLint's default suppressions file, at the repo root. */
export const SUPPRESSIONS_FILE = "eslint-suppressions.json";
/** The trailer that lets a listed file through, with a reason on the same
 *  line. Git reads trailer keys without regard to case. */
export const DEFERRED_TRAILER = /^Lint-deferred:[ \t]*\S/im;

/**
 * The staged files that are listed, each with the rules it is listed for.
 *
 * @param {readonly string[]} staged - repo-relative paths in the commit
 * @param {Record<string, Record<string, {count: number}>>} listed - the
 *   staged suppressions file, keyed by repo-relative path
 * @returns {{file: string, rules: string[]}[]}
 */
export function listedInCommit(staged, listed) {
  return staged
    .filter((file) => Object.hasOwn(listed, file))
    .map((file) => ({file, rules: Object.keys(listed[file])}));
}

/** Whether the message defers the tidy with a reason. */
export function defers(message) {
  return DEFERRED_TRAILER.test(message);
}

const git = (...args) => execFileSync("git", args,
  {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]});

/** Whether git can resolve a ref or object, without throwing. */
function resolves(ref) {
  try {
    git("rev-parse", "-q", "--verify", ref);
    return true;
  } catch {
    // Not resolvable is the answer asked for, not a failure.
    return false;
  }
}

/** The repo's suppressions as staged; none where the repo stages no list.
 *  A list that is staged but unreadable throws: it is not an empty list. */
function stagedSuppressions() {
  if (!resolves(`:${SUPPRESSIONS_FILE}`)) return {};
  return JSON.parse(git("show", `:${SUPPRESSIONS_FILE}`));
}

/** Suppressions files tracked anywhere but the repo root. */
function listsBelowRoot() {
  return git("ls-files", `*${SUPPRESSIONS_FILE}`).split("\n")
    .filter((path) => path && path !== SUPPRESSIONS_FILE);
}

/** The paths the commit touches, a rename under both its old and new path
 *  and a deletion under its own. */
function stagedPaths() {
  return git("diff", "--cached", "--name-only", "--no-renames",
    "--diff-filter=ACMRD").split("\n").filter(Boolean);
}

function main(messageFile) {
  if (resolves("MERGE_HEAD")) return;
  const elsewhere = listsBelowRoot();
  if (elsewhere.length > 0) {
    console.error("check-listed-files: suppressions lists below the repo "
      + `root are not read, so this check cannot hold: ${elsewhere.join(", ")}`);
    process.exit(1);
  }
  const hits = listedInCommit(stagedPaths(), stagedSuppressions());
  if (hits.length === 0) return;
  if (defers(readFileSync(messageFile, "utf8"))) {
    for (const {file} of hits) {
      console.warn(`check-listed-files: ${file} is listed; tidy deferred`);
    }
    return;
  }
  console.error("check-listed-files: this commit changes files listed in "
    + `${SUPPRESSIONS_FILE}. Tidy each in its own commit first (fix it, `
    + "then eslint --prune-suppressions), or add a 'Lint-deferred: <why>' "
    + "trailer:");
  for (const {file, rules} of hits) {
    console.error(`  ${file}: ${rules.join(", ")}`);
  }
  process.exit(1);
}

// Run through npm's bin symlink, argv[1] is the link and import.meta.url
// the real file, so compare real paths.
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv[2]);
}
