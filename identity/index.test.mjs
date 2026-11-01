#!/usr/bin/env node
// Tests for the shared Organization. Every Casomo site prints these values
// as its publisher, so they are pinned exactly: a typo in a profile address
// would otherwise pass every structural check and ship to every page.
import {strict as assert} from "node:assert";

import {
  CASOMO_ORGANIZATION,
  COMPANY_REGISTER,
  ICO_REGISTER,
  REGISTERED_OFFICE,
} from "./index.mjs";

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

// The registrations, pinned as the registers publish them.
assert.deepEqual(COMPANY_REGISTER, {
  number: "15030496",
  url:
    "https://find-and-update.company-information.service.gov.uk"
    + "/company/15030496",
});
assert.deepEqual(ICO_REGISTER, {
  number: "ZC219565",
  url: "https://ico.org.uk/ESDWebPages/Entry/ZC219565",
});
assert.ok(Object.isFrozen(COMPANY_REGISTER));
assert.ok(Object.isFrozen(ICO_REGISTER));
for (const {number, url} of [COMPANY_REGISTER, ICO_REGISTER]) {
  assert.ok(url.endsWith(number), "a register's page names its number");
}
assert.equal(
  REGISTERED_OFFICE,
  "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ",
);

console.log("identity: ok");
