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
  readonly sameAs: readonly string[];
}

export declare const CASOMO_ORGANIZATION: CasomoOrganization;
