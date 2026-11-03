/**
 * A form's settings as a push writes them: its own, the respondent's
 * confirmation email, and the owner's notification.
 */
import {answerRef, itemByKey} from "./fields.mjs";
import {Paths} from "./address.mjs";
import {plainSetting, richText} from "./rich-text.mjs";

/** @import {
 *    FormDefinition, FormSettings, Mention, Question, RespondentEmail,
 *    RespondentEmailSettings, RichText, SelfEmailSettings, SelfNotification,
 *    TallySettings,
 *  } from "./index.d.mts" */

/** @param {FormDefinition} form @returns {TallySettings} */
export function toSettings(form) {
  const email = form.confirmationEmail;
  const respondent = email
    ? respondentEmailSettings(form, email)
    : {hasRespondentEmailNotifications: /** @type {const} */ (false)};
  const self = form.notification ? selfEmailSettings(form, form.notification) : {};
  return {...tallySettings(form.settings), ...respondent, ...self};
}

/**
 * The form's own settings in the order it gives them, without `badges`,
 * which is the translator's, written into the options it draws: Tally has no
 * setting by that name.
 * @param {FormSettings} settings
 * @returns {Omit<FormSettings, "badges">}
 */
function tallySettings(settings) {
  return /** @type {Omit<FormSettings, "badges">} */ (Object.fromEntries(
    Object.entries(settings).filter(([key]) => key !== "badges")));
}

/**
 * @param {Pick<FormDefinition, "key" | "pages">} form
 * @param {RespondentEmail} email
 * @returns {RespondentEmailSettings}
 */
function respondentEmailSettings(form, email) {
  const at = new Paths(form.key);
  const question = emailQuestion(form, email.to, "respondent email");
  return {
    hasRespondentEmailNotifications: true,
    respondentEmailTo: mentionOf(at, question, "respondentEmailTo"),
    respondentEmailFromName: plainSetting(email.fromName),
    respondentEmailReplyTo: plainSetting(email.replyTo),
    respondentEmailSubject: plainSetting(email.subject),
    respondentEmailBody: {safeHTMLSchema: richText(email.body), mentions: []},
    respondentEmailAttachPdf: email.attachPdf,
  };
}

/**
 * @param {Pick<FormDefinition, "key" | "pages">} form
 * @param {SelfNotification} notification
 * @returns {SelfEmailSettings}
 */
function selfEmailSettings(form, notification) {
  const at = new Paths(form.key);
  const question = emailQuestion(form, notification.replyTo, "owner notification");
  return {
    hasSelfEmailNotifications: true,
    selfEmailTo: plainSetting(notification.to),
    selfEmailReplyTo: mentionOf(at, question, "selfEmailReplyTo"),
    selfEmailSubject: plainSetting(notification.subject),
  };
}

/**
 * The email question a key names; throws on any other, because Tally would
 * accept the setting and send nothing.
 * @param {Pick<FormDefinition, "key" | "pages">} form
 * @param {string} key
 * @param {string} what
 */
function emailQuestion(form, key, what) {
  const question = itemByKey(form, key);
  if (question?.kind !== "email") {
    throw new Error(`${what}: ${key} is not an email question`);
  }
  return question;
}

/**
 * A setting whose text is one answer. Tally stores a mention as a run marked
 * with its uuid, and adds the span tag itself, so sending it already there
 * lets a read-back match.
 * @param {Paths} at
 * @param {Question} question
 * @param {string} setting
 * @returns {RichText}
 */
function mentionOf(at, question, setting) {
  /** @type {Mention} */
  const mention = {
    uuid: at.mention(setting),
    field: answerRef(at, question),
    defaultValue: "",
  };
  return {
    safeHTMLSchema: [
      [`@${question.title}`, [["tag", "span"], ["mention", mention.uuid]]],
    ],
    mentions: [mention],
  };
}
