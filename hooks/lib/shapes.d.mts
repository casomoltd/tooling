/** A character a path in a let-through shape may hold, as a regex source. */
export declare const PLAIN_PATH_CHAR: string;

/** Whether a command is one of an unattended dependency sweep's own two: its
 *  commit, or the push of its `dep-sweep` branch, inside a
 *  `worktrees/dep-sweep-*` checkout, whole-command strict. */
export declare function isSweepCommand(command: string): boolean;
