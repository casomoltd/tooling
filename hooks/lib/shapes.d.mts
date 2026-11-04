/** A character a path in a matched shape may hold, as a regex source. */
export declare const PLAIN_PATH_CHAR: string;

/** The commit form, as it is written to a person. */
export declare const COMMIT_FORM: string;

/** A commit in the commit form: the repo it runs in and its message file. */
export interface FormCommit {
  repo: string;
  messageFile: string;
}

/** A command in the commit form, read to its repo and message file, or
 *  undefined for any other command. */
export declare function matchCommitForm(command: string): FormCommit | undefined;
