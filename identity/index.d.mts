import type {UtmTags} from "../attribution/index.d.mts";

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

/** The values Casomo's tagged links carry: a link is tagged only where the
 *  referrer goes missing, as from an email. */
export declare const CASOMO_UTM: {
  readonly sources: readonly ["casomo", "signature"];
  readonly media: readonly ["email"];
  readonly content: readonly ["showcase", "profile", "casomoltd"];
};

/** A link to a Casomo page with its tags added: `utmTagger` bound to
 *  {@link CASOMO_UTM}. Throws on a value the lists don't hold. */
export declare const tagged: (url: string, tags: UtmTags<
  (typeof CASOMO_UTM)["sources"][number],
  (typeof CASOMO_UTM)["media"][number],
  (typeof CASOMO_UTM)["content"][number]
>) => string;
