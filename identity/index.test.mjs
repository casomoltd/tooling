#!/usr/bin/env node
// Tests for the shared Organization. Every Casomo site prints these values
// as its publisher, so they are pinned exactly: a typo in a profile address
// would otherwise pass every structural check and ship to every page.
import {strict as assert} from "node:assert";

import {
  CASOMO_ORGANIZATION,
  CASOMO_UTM,
  COMPANY_COLOPHON,
  COMPANY_REGISTER,
  ICO_REGISTER,
  LINKEDIN,
  REGISTERED_OFFICE,
  tagged,
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
    // The GitHub organisation and the npm organisation.
    "https://github.com/casomoltd",
    "https://www.npmjs.com/org/casomoltd",
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

// The colophon's company lines: registration, ICO, office, each proved by
// its register or published at its source.
assert.deepEqual(COMPANY_COLOPHON, [
  {text: "Registered in England and Wales, company", register: COMPANY_REGISTER},
  {text: "ICO registration", register: ICO_REGISTER},
  {text: `Registered office: ${REGISTERED_OFFICE}`, source: COMPANY_REGISTER.url},
]);
assert.ok(Object.isFrozen(COMPANY_COLOPHON));
for (const {number, url} of [COMPANY_REGISTER, ICO_REGISTER]) {
  assert.ok(url.endsWith(number), "a register's page names its number");
}
assert.equal(
  REGISTERED_OFFICE,
  "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ",
);

// The tags Casomo's links carry. Every tagged link a site or the signature
// publishes is built from these, so a renamed value would split one channel
// into two in the analytics.
assert.deepEqual(CASOMO_UTM, {
  sources: ["casomo", "signature", "blog"],
  media: ["email", "footer"],
  content: ["showcase", "profile", "casomoltd"],
});
assert.equal(tagged("https://casomoltd.com/", {source: "signature", medium: "email"}),
  "https://casomoltd.com/?utm_source=signature&utm_medium=email");

// The company's LinkedIn pages, one per site's brand; the company page is
// the one the organisation's sameAs names.
assert.deepEqual(LINKEDIN, {
  casomoltd: "https://www.linkedin.com/company/111967567/",
  showcase: "https://www.linkedin.com/showcase/146767658/",
});
assert.ok(Object.isFrozen(LINKEDIN));
assert.ok(CASOMO_ORGANIZATION.sameAs.includes(LINKEDIN.casomoltd));
assert.deepEqual(Object.keys(LINKEDIN).sort(),
  CASOMO_UTM.content.filter((c) => c !== "profile").sort());

console.log("identity: ok");
