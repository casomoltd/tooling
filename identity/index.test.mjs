#!/usr/bin/env node
// Tests for the shared Organization. Every Casomo site prints these values
// as its publisher, so they are pinned exactly: a typo in a profile address
// would otherwise pass every structural check and ship to every page.
import {strict as assert} from "node:assert";

import {CASOMO_ORGANIZATION} from "./index.mjs";

assert.deepEqual(CASOMO_ORGANIZATION, {
  "@type": "Organization",
  "@id": "https://casomoltd.com/#organization",
  name: "Casomo Ltd",
  url: "https://casomoltd.com",
  logo: "https://casomoltd.com/assets/icon.svg",
  sameAs: [
    // The NHS-facing site.
    "https://casomo.co.uk",
    // The Facebook Page, as its owner gave it.
    "https://www.facebook.com/casomouk",
    // The LinkedIn company page, by its numeric id.
    "https://www.linkedin.com/company/111967567/",
  ],
});

assert.ok(Object.isFrozen(CASOMO_ORGANIZATION));
assert.ok(Object.isFrozen(CASOMO_ORGANIZATION.sameAs));
const {sameAs, url} = CASOMO_ORGANIZATION;
assert.equal(new Set(sameAs).size, sameAs.length, "no profile twice");
assert.ok(!sameAs.includes(url), "sameAs names other places, not the url");
assert.ok(
  CASOMO_ORGANIZATION.logo.startsWith(`${url}/`),
  "the mark is the company's own",
);

console.log("identity: ok");
