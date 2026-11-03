/**
 * Tags for links a site publishes, from lists the site owns: a visit is
 * attributed from its referrer, so a link is tagged only where the referrer
 * goes missing, as from an email, and every tagged link names one of a short
 * list of values, so a typo can't start a new channel in the analytics.
 */

/** @import * as Attribution from "./index.d.mts" */

/**
 * A function that tags a link with values from these lists, refusing any
 * other. Typed by its declaration, so the two can't disagree.
 * @type {typeof Attribution.utmTagger}
 */
export const utmTagger = (lists) => {
  return (url, {source, medium, content}) => {
    known(lists.sources, source, "utm_source");
    known(lists.media, medium, "utm_medium");
    if (content !== undefined) known(lists.content, content, "utm_content");
    const link = new URL(url);
    link.searchParams.set("utm_source", source);
    link.searchParams.set("utm_medium", medium);
    if (content !== undefined) link.searchParams.set("utm_content", content);
    return link.href;
  };
};

/** @param {readonly string[]} list @param {string} value @param {string} name */
function known(list, value, name) {
  if (!list.includes(value)) {
    throw new Error(`${name} ${value} is not one of ${list.join(", ")}`);
  }
}
