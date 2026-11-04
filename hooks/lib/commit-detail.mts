// What a commit is about to record, for its confirmation prompt: the repo it
// lands in, the files staged and the message, which the command alone
// doesn't show. The commit is one in the commit form (`COMMIT_FORM` in
// command-shapes.mjs; the tooling package's docs/commit.md § The command).
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {basename} from "node:path";
import type {FormCommit} from "./shapes.d.mts";

/** Runs git in a repo and returns its output. */
export type Git = (repo: string, args: readonly string[]) => string;

/** Reads a file's text. */
export type ReadText = (file: string) => string;

/** How long a git read may take: the hook wraps every Bash call, so a git
 *  stuck on a lock must not hold the prompt. */
const GIT_TIMEOUT_MS = 5_000;

/** The prompt's account of a commit in the form. A part that can't be read
 *  says so, and the rest still show. */
export function commitDetail(
  {repo, messageFile}: FormCommit,
  git: Git = runGit,
  read: ReadText = readText,
): string {
  return [
    `Repo: ${basename(repo)} (${repo})`,
    attempt("the staged files", () =>
      ["Staged:", ...indent(git(repo, ["diff", "--cached", "--name-status"]))]),
    attempt("the message", () => ["Message:", ...indent(read(messageFile))]),
  ].join("\n");
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
