// What a commit is about to record, for its confirmation prompt: the repo it
// lands in, the files staged and the message, which the command alone
// doesn't show. It reads one form only, the one a commit is made in
// (docs/commit.md § The command):
//
//   git -C <absolute repo path> commit -F <absolute message file>
//
// Any other command gets a line saying so.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {basename} from "node:path";

/** Runs git in a repo and returns its output. */
export type Git = (repo: string, args: readonly string[]) => string;

/** Reads a file's text. */
export type ReadText = (file: string) => string;

/** A commit in the form: the repo it runs in and its message file. */
export interface FormCommit {
  repo: string;
  messageFile: string;
}

/** The form as it is written to a person. */
export const COMMIT_FORM =
  "git -C <absolute repo path> commit -F <absolute message file>";

/** An absolute path of plain characters only: a word holding `;`, `&`, `$`
 *  or a quote could carry a second command, which the form exists to rule
 *  out. */
const PATH = /^\/[\w./@+-]+$/;

/** How long a git read may take: the hook wraps every Bash call, so a git
 *  stuck on a lock must not hold the prompt. */
const GIT_TIMEOUT_MS = 5_000;

/** The prompt's account of the commit, or a line naming the form when it
 *  isn't in it. A part that can't be read says so, and the rest still
 *  show. */
export function commitDetail(
  command: string,
  git: Git = runGit,
  read: ReadText = readText,
): string {
  const commit = parseCommit(command);
  if (!commit) return `Not in the form \`${COMMIT_FORM}\`: read the command.`;
  const {repo, messageFile} = commit;
  return [
    `Repo: ${basename(repo)} (${repo})`,
    attempt("the staged files", () =>
      ["Staged:", ...indent(git(repo, ["diff", "--cached", "--name-status"]))]),
    attempt("the message", () => ["Message:", ...indent(read(messageFile))]),
  ].join("\n");
}

/** A command in the form, read by position, else undefined: exactly the
 *  words `git -C <path> commit -F <path>`, single-spaced, each path plain. */
export function parseCommit(command: string): FormCommit | undefined {
  const words = command.trim().split(" ");
  const [git, flagC, repo, commit, flagF, messageFile, ...rest] = words;
  const fits = git === "git" && flagC === "-C" && commit === "commit"
    && flagF === "-F" && rest.length === 0
    && PATH.test(repo ?? "") && PATH.test(messageFile ?? "");
  return fits ? {repo, messageFile} : undefined;
}

function runGit(repo: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readText(file: string): string {
  return readFileSync(file, "utf8");
}

/** One part of the prompt, or a line saying it couldn't be read. */
function attempt(what: string, lines: () => string[]): string {
  try {
    return lines().join("\n");
  } catch (err) {
    const why = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return `Couldn't read ${what}: ${why}`;
  }
}

/** Text as indented lines, without its trailing blank line. */
function indent(text: string): string[] {
  return text.trimEnd().split("\n").map((line) => `  ${line}`);
}
