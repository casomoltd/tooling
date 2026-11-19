/**
 * Tags for links a site publishes, from values the site owns: a visit is
 * attributed from its referrer, so a link is tagged only where the referrer
 * goes missing, as from an email or an advert, and every tagged link carries
 * a value the site declared, a short list or, for a campaign minted as it is
 * made, a pattern, so a typo can't start a new channel in the analytics.
 */

/** @import * as Attribution from "./index.d.mts" */

/** The query parameters a tag is written as: the names a site that reads
 *  the tags back, a contact form keeping them say, takes from here.
 *  @type {typeof Attribution.UTM_PARAMS} */
export const UTM_PARAMS = Object.freeze({
  source: "utm_source",
  medium: "utm_medium",
  content: "utm_content",
  campaign: "utm_campaign",
});

/**
 * A function that tags a link with values from these lists, refusing any
 * other. Typed by its declaration, so the two can't disagree.
 * @type {typeof Attribution.utmTagger}
 */
export const utmTagger = (lists) => {
  const {campaigns} = lists;
  if (campaigns?.global || campaigns?.sticky) {
    // Such a pattern remembers where it last matched, so one value would be
    // accepted and then refused.
    throw new Error("a campaign pattern cannot carry the g or y flag");
  }
  return (url, {source, medium, content, campaign}) => {
    known(lists.sources, source, UTM_PARAMS.source);
    known(lists.media, medium, UTM_PARAMS.medium);
    if (content !== undefined) known(lists.content, content, UTM_PARAMS.content);
    if (campaign !== undefined) matches(lists.campaigns, campaign, UTM_PARAMS.campaign);
    const link = new URL(url);
    link.searchParams.set(UTM_PARAMS.source, source);
    link.searchParams.set(UTM_PARAMS.medium, medium);
    if (content !== undefined) link.searchParams.set(UTM_PARAMS.content, content);
    if (campaign !== undefined) link.searchParams.set(UTM_PARAMS.campaign, campaign);
    return link.href;
  };
};

/** @param {readonly string[]} list @param {string} value @param {string} name */
function known(list, value, name) {
  if (!list.includes(value)) {
    throw new Error(`${name} ${value} is not one of ${list.join(", ")}`);
  }
}

/** A value minted as it is made can't be listed in advance, so the site
 *  gives a pattern for it.
 *  @param {RegExp | undefined} pattern @param {string} value @param {string} name */
function matches(pattern, value, name) {
  if (pattern === undefined) {
    throw new Error(`${name} ${value}: these lists give no pattern for it`);
  }
  if (!pattern.test(value)) {
    throw new Error(`${name} ${value} does not match ${pattern}`);
  }
}
