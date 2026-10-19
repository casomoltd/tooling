/** A newsletter field's value: a string, or the structured settings
 *  Buttondown takes as JSON (socials, theme_configuration). */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | FieldValue[]
  | {[key: string]: FieldValue};

/** Every field the newsletter is set to, by Buttondown field name. */
export type Payload = Record<string, FieldValue>;

/** The one newsletter a repo may write to. */
export interface Newsletter {
  id: string;
  /** The prefixed id some Buttondown endpoints return for the same one. */
  publicId?: string;
  username: string;
}

/** A repo's settings, as resolved from `buttondown` in casomo.config.mjs,
 *  with every path absolute. */
export interface Settings {
  root: string;
  newsletter: Newsletter;
  dir: string;
  globals: string;
  tokens: [target: string, source: string][];
  extra: [target: string, value: string][];
  asserts: Record<string, string>;
  allowedHides: Record<string, string>;
  linkClasses: string[];
  ownLinks: string[];
  paletteFiles: string[];
  checks: string[];
}

/** What a repo's own gate receives: the default export of each file
 *  under `checks` takes this and resolves to its problems, empty when
 *  clean. */
export interface CheckContext {
  root: string;
  payload: Payload;
  /** The site's tokens stylesheet. */
  css: string;
  /** The web skin and the email skin, as written. */
  web: string;
  email: string;
  readToken(css: string, name: string): string;
}

export type Check = (context: CheckContext) => Promise<string[]>;

/** Buttondown's email chrome, for a repo whose emails draw their own
 *  bands: spread into `allowedHides` to allow hiding it. */
export const EMAIL_CHROME_HIDES: Readonly<Record<string, string>>;

export function loadSettings(root?: string): Promise<Settings>;

export function buildPayload(settings: Settings): Promise<Payload>;

/** A reader for one stylesheet's `:root` and `@theme` tokens. */
export function tokenReader(
  file: string | URL,
): Promise<(name: string) => string>;
