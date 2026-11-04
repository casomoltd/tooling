/** The months Tally keeps a contact message before deleting it, as each
 *  contact form's "Submissions data retention" is set in Tally's editor. */
export declare const TALLY_CONTACT_MESSAGE_MONTHS: number;

/** The days after the last exchange before the inbox copy of a message is due
 *  for deletion. */
export declare const CONTACT_INBOX_DAYS: number;

/** The months after the last exchange before the record of a conversation is
 *  due for deletion. */
export declare const CONVERSATION_RECORDS_MONTHS: number;

/** Tally's statement of how long its backups keep deleted form data. */
export declare const TALLY_BACKUPS_URL: `https://${string}`;

/** The days Tally's backups keep deleted form data, as that statement says. */
export declare const TALLY_BACKUP_DAYS: number;
