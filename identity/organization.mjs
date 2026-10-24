/**
 * Casomo Ltd as search engines should see it: the one schema.org
 * `Organization` every Casomo site names in its JSON-LD. Each site imports
 * this rather than typing its own, so no two sites can disagree about who
 * publishes them, and `sameAs` ties them all to the same profiles.
 *
 * Public facts only: the company's name and the addresses its pages already
 * print. A person, such as an article's author, stays with the site.
 */
const SITE = "https://casomoltd.com";

/** @type {import("./index.d.mts").CasomoOrganization} */
export const CASOMO_ORGANIZATION = Object.freeze({
  "@type": "Organization",
  // One id across every site, so a crawler merges them into one entity.
  "@id": `${SITE}/#organization`,
  name: "Casomo Ltd",
  url: SITE,
  sameAs: Object.freeze([
    "https://casomo.co.uk",
    "https://www.facebook.com/casomouk",
    "https://www.linkedin.com/company/111967567/",
  ]),
});
