/**
 * Casomo Ltd's public identity, which every Casomo site imports rather than
 * typing its own, so no two sites can disagree about the company. Here are the
 * schema.org `Organization` every site names in its JSON-LD, whose `sameAs`
 * ties them all to the same profiles, and the company's entries on the public
 * registers, each by its number and the page that shows it.
 *
 * Public facts only: the company's name, its mark, the public addresses it
 * is known by, and its public registrations. A person, such as an article's
 * author, stays with the site.
 */
const SITE = "https://casomoltd.com";

/** @type {import("./index.d.mts").CasomoOrganization} */
export const CASOMO_ORGANIZATION = Object.freeze({
  "@type": "Organization",
  // One id across every site, so a crawler merges them into one entity.
  "@id": `${SITE}/#organization`,
  name: "Casomo Ltd",
  url: SITE,
  // The company's mark, as its own site serves it. Each site keeps its own
  // favicon and palette; this is the one logo the company is known by.
  logo: `${SITE}/assets/icon.svg`,
  sameAs: Object.freeze([
    "https://casomo.co.uk",
    "https://www.facebook.com/casomouk",
    "https://www.linkedin.com/company/111967567/",
  ]),
});

const COMPANY_NUMBER = "15030496";
/**
 * The company's Companies House record.
 * @type {import("./index.d.mts").Registration}
 */
export const COMPANY_REGISTER = Object.freeze({
  number: COMPANY_NUMBER,
  url:
    "https://find-and-update.company-information.service.gov.uk"
    + `/company/${COMPANY_NUMBER}`,
});

const ICO_NUMBER = "ZC219565";
/**
 * The company's registration with the ICO, as a data controller.
 * @type {import("./index.d.mts").Registration}
 */
export const ICO_REGISTER = Object.freeze({
  number: ICO_NUMBER,
  url: `https://ico.org.uk/ESDWebPages/Entry/${ICO_NUMBER}`,
});

/** The company's registered office, as Companies House holds it. */
export const REGISTERED_OFFICE =
  "71-75 Shelton Street, Covent Garden, London, WC2H 9JQ";
