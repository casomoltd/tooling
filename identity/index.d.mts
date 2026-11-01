/** Casomo Ltd as a schema.org `Organization`, for a page's JSON-LD.
 *
 *  Every field is read-only because the value is frozen: spread it into an
 *  untyped object literal, or type a JSON-LD field that holds it as
 *  `readonly string[]`, never as `string[]`. */
export interface CasomoOrganization {
  readonly "@type": "Organization";
  readonly "@id": string;
  readonly name: string;
  readonly url: string;
  readonly logo: string;
  readonly sameAs: readonly string[];
}

export declare const CASOMO_ORGANIZATION: CasomoOrganization;

/** An entry on a public register: its number, and the page that shows it. */
export interface Registration {
  readonly number: string;
  readonly url: string;
}

/** The company's Companies House record. */
export declare const COMPANY_REGISTER: Registration;
/** The company's registration with the ICO, as a data controller. */
export declare const ICO_REGISTER: Registration;
/** The company's registered office, as Companies House holds it. */
export declare const REGISTERED_OFFICE: string;
