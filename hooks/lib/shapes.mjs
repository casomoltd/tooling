/**
 * The command shapes the guards let through on their exact form alone, and
 * the character class that keeps them exact.
 *
 * Plain JS with a declaration beside it, so a consuming repo's own hook can
 * import the same shapes from the package (`@casomoltd/tooling/hooks/shapes`)
 * rather than re-spell them: Node strips TypeScript nowhere under
 * `node_modules`.
 */

/** A character a path in a let-through shape may hold: no `;`, `&`, `|`, `$`,
 *  quote or bracket, any of which could carry a second command. */
export const PLAIN_PATH_CHAR = String.raw`[\w./@+-]`;

/** A sweep worktree's directory, as the dependency sweep creates it. */
const SWEEP_PATH = String.raw`/worktrees/dep-sweep-[\w.-]+`;

/** The worktree a sweep command runs in: plain characters, or the same plus
 *  a space when quoted. */
const SWEEP_TARGET =
  String.raw`(?:"[\w./@+ -]*${SWEEP_PATH}"|${PLAIN_PATH_CHAR}*${SWEEP_PATH})`;

/** The sweep's two branch-side actions: its commit, and the push of its own
 *  branch. */
const SWEEP_ACTIONS = [
  String.raw`git commit -F ${PLAIN_PATH_CHAR}+`,
  String.raw`git push --force-with-lease -u origin dep-sweep`,
];

/** A sweep command, whole: `cd <sweep worktree> && <one action>`. */
const SWEEP_COMMAND = new RegExp(
  String.raw`^cd\s+${SWEEP_TARGET}\s+&&\s+(?:${SWEEP_ACTIONS.join("|")})$`,
);

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
