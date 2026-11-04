/**
 * How long Casomo keeps what a reader sends, as every Casomo site's privacy
 * page states it: one company, so one set of periods, and a site that names
 * one imports it rather than keeping a copy that drifts. The periods are the
 * company's own, from its record of processing activities; Tally's backup
 * window is Tally's, from its statement. A period that only one site's forms
 * have stays in that site.
 *
 * Its types are index.d.mts.
 */

/** The months Tally keeps a contact message before deleting it: each contact
 *  form's "Submissions data retention", set in Tally's editor (a push leaves
 *  it alone, as the form code sends no such setting). Tally counts it in
 *  months. */
export const TALLY_CONTACT_MESSAGE_MONTHS = 3;

/** The days after our last exchange with someone before our inbox copy of
 *  their message is due for deletion, at the next monthly review. Counted
 *  from the last exchange, so it resets while a conversation goes on. */
export const CONTACT_INBOX_DAYS = 90;

/** The months after our last exchange with someone before our record of the
 *  conversation is due for deletion, at the next monthly review. */
export const CONVERSATION_RECORDS_MONTHS = 12;

/** Tally's own statement that deleted form data leaves its backups within
 *  `TALLY_BACKUP_DAYS` (read 6 Oct 2026). */
export const TALLY_BACKUPS_URL = "https://tally.so/help/gdpr";

/** The days Tally's backups keep deleted form data, as `TALLY_BACKUPS_URL`
 *  states: a fact about Tally's backups, not a promise of ours. */
export const TALLY_BACKUP_DAYS = 90;
