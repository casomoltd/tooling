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

/** The company's LinkedIn pages, by the `utm_content` value a link to each
 *  carries: the company page, and casomo.co.uk's consumer showcase. A site
 *  links its own; a person's profile stays with the site.
 *  @type {import("./index.d.mts").CasomoLinkedIn} */
export const LINKEDIN = Object.freeze({
  casomoltd: "https://www.linkedin.com/company/111967567/",
  showcase: "https://www.linkedin.com/showcase/146767658/",
});

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
    LINKEDIN.casomoltd,
    // Where the company's open-source libraries are developed and published.
    "https://github.com/casomoltd",
    "https://www.npmjs.com/org/casomoltd",
  ]),
});

const COMPANY_NUMBER = "15030496";
/**
 * The company's Companies House record.
 * @type {import("./index.d.mts").Registration}
 */
export const COMPANY_REGISTER = Object.freeze({
  number: COMPANY_NUMBER,
  url: `https://find-and-update.company-information.service.gov.uk/company/${
    COMPANY_NUMBER}`,
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

/**
 * The lines every site's colophon carries about the company, in order: its
 * registration, its ICO registration and its registered office. A site adds
 * its own lines around them.
 * @type {readonly import("./index.d.mts").ColophonLine[]}
 */
export const COMPANY_COLOPHON = Object.freeze([
  Object.freeze({
    text: "Registered in England and Wales, company",
    register: COMPANY_REGISTER,
  }),
  Object.freeze({text: "ICO registration", register: ICO_REGISTER}),
  Object.freeze({
    text: `Registered office: ${REGISTERED_OFFICE}`,
    source: COMPANY_REGISTER.url,
  }),
]);
