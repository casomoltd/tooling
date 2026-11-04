/**
 * Tags for links a site publishes, from lists the site owns: a visit is
 * attributed from its referrer, so a link is tagged only where the referrer
 * goes missing, as from an email, and every tagged link names one of a short
 * list of values, so a typo can't start a new channel in the analytics.
 */

/** @import * as Attribution from "./index.d.mts" */

/** The query parameters a tag is written as: the names a site that reads
 *  the tags back, a contact form keeping them say, takes from here.
 *  @type {typeof Attribution.UTM_PARAMS} */
export const UTM_PARAMS = Object.freeze({
  source: "utm_source",
  medium: "utm_medium",
  content: "utm_content",
});

/**
 * A function that tags a link with values from these lists, refusing any
 * other. Typed by its declaration, so the two can't disagree.
 * @type {typeof Attribution.utmTagger}
 */
export const utmTagger = (lists) => {
  return (url, {source, medium, content}) => {
    known(lists.sources, source, UTM_PARAMS.source);
    known(lists.media, medium, UTM_PARAMS.medium);
    if (content !== undefined) known(lists.content, content, UTM_PARAMS.content);
    const link = new URL(url);
    link.searchParams.set(UTM_PARAMS.source, source);
    link.searchParams.set(UTM_PARAMS.medium, medium);
    if (content !== undefined) link.searchParams.set(UTM_PARAMS.content, content);
    return link.href;
  };
};

/** @param {readonly string[]} list @param {string} value @param {string} name */
function known(list, value, name) {
  if (!list.includes(value)) {
    throw new Error(`${name} ${value} is not one of ${list.join(", ")}`);
  }
}
