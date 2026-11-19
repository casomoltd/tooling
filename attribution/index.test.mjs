#!/usr/bin/env node
// Tests for the link tagger: a tagged link carries exactly the values asked
// for, and a value outside the lists is refused, so a typo can't split one
// channel into two in the analytics.
import {strict as assert} from "node:assert";

import {UTM_PARAMS, utmTagger} from "./tagger.mjs";

const tagged = utmTagger({
  sources: ["newsletter", "signature"],
  media: ["email"],
  content: ["main", "second"],
});
const taggedWithCampaigns = utmTagger({
  sources: ["newsletter", "signature"],
  media: ["email"],
  content: ["main", "second"],
  campaigns: /^ad-\d+$/,
});

assert.equal(
  tagged("https://example.com/", {source: "signature", medium: "email"}),
  "https://example.com/?utm_source=signature&utm_medium=email");
assert.equal(
  tagged("https://example.com/contact?topic=bug",
    {source: "newsletter", medium: "email", content: "second"}),
  "https://example.com/contact?topic=bug&utm_source=newsletter&utm_medium=email"
    + "&utm_content=second");

// A caller without the types gets the same refusal at run time.
assert.throws(
  // @ts-expect-error: not a listed source.
  () => tagged("https://example.com/", {source: "social", medium: "email"}),
  /utm_source social is not one of newsletter, signature/);
assert.throws(
  // @ts-expect-error: not a listed medium.
  () => tagged("https://example.com/", {source: "newsletter", medium: "web"}),
  /utm_medium web/);
assert.throws(
  () => tagged("https://example.com/", {source: "newsletter", medium: "email",
    // @ts-expect-error: not a listed account.
    content: "third"}),
  /utm_content third/);

// A campaign names one advert, so it is checked against a pattern, and only
// where the lists name campaigns at all.
assert.equal(
  taggedWithCampaigns("https://example.com/",
    {source: "newsletter", medium: "email", campaign: "ad-12"}),
  "https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=ad-12");
assert.throws(
  () => taggedWithCampaigns("https://example.com/",
    {source: "newsletter", medium: "email", campaign: "AD-1"}),
  /utm_campaign AD-1 does not match/);
assert.throws(
  () => tagged("https://example.com/",
    {source: "newsletter", medium: "email", campaign: "ad-1"}),
  /utm_campaign ad-1: these lists give no pattern for it/);

// A pattern that remembers its last match would refuse a value it accepted a
// moment before, so one with such a flag is refused at once.
assert.throws(
  () => utmTagger({sources: ["a"], media: ["b"], content: ["c"], campaigns: /ad-1/g}),
  /cannot carry the g or y flag/);

// The names a tag is written as, which a site reading the tags back names
// them from.
assert.deepEqual(UTM_PARAMS, {
  source: "utm_source", medium: "utm_medium", content: "utm_content",
  campaign: "utm_campaign",
});
assert.ok(Object.isFrozen(UTM_PARAMS));

console.log("attribution tests OK");
