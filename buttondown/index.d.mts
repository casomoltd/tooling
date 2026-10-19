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
  /** The file holding the web skin's TOKENS block. */
  webSkin: string;
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
  /** The web skin and the email skin as sent: composed, base rules and
   *  site rules together. */
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

/** The opening tag every band's table shares. */
export const TABLE: string;

/** A site's email theme, read by both `emailBaseCss` and
 *  `createEmailBlocks`, so each font and colour has one producer. */
export interface EmailTheme {
  fonts: {body: string; heading: string};
  colours: {page: string; ink: string; heading: string};
  /** Line heights: of the page, and of prose. */
  leading: {body: string; prose: string};
}

export interface EmailBlockOptions {
  theme: EmailTheme;
  colours: {
    titleGround: string; action: string; actionInk: string;
    footerGround: string; footerRule: string;
  };
  rhythm: {
    cardPadding: string; buttonCell: string; buttonSize: string;
    buttonPadding: string; footerRuleWidth: string;
    footerCells: [top: string, bottom: string];
  };
  /** The small print's inline style. */
  small: string;
  /** The class the email skin keys the button's rule on. */
  buttonClass: string;
  smallLink(href: string, text: string): string;
  colophon: string;
  copyright: string;
  /** What joins the colophon to the subscription sentence. */
  sentenceBreak: string;
  signoff: string;
}

export interface EmailBlocks {
  bodyLink(href: string, text: string): string;
  button(href: string, label: string): string;
  card(title: string): string;
  footer(options: {subscription: boolean}): string;
  p(html: string, margin?: string): string;
  signoff(): string;
  spacer(height: number): string;
}

/** The bands an email is built from, in one site's theme. */
export function createEmailBlocks(options: EmailBlockOptions): EmailBlocks;

/** The web skin: the shared rules inserted after the site stylesheet's
 *  leading comments and @charset, @import and @layer statements, ahead of
 *  its own rules. */
export function composeWebSkin(site: string): string;

/** The shared email rules, in the site's theme, with literal values. */
export function emailBaseCss(theme: EmailTheme): string;

/** The register that proves a colophon line, by its number. */
export interface Register {
  readonly number: string;
  readonly url: string;
}

/** One colophon line, its text without the closing full stop: then the
 *  register that proves it, or the http(s) source where a line without
 *  one is explained or published. */
export type ColophonLine =
  | {readonly text: string; readonly register: Register; readonly source?: never}
  | {readonly text: string; readonly source: string; readonly register?: never};

/** A labelled Buttondown `socials` entry. */
export interface ColophonLink {
  type: "generic";
  url: string;
  label: string;
}

/** A colophon as `socials` links, each URL marked with a `colophon`
 *  query (`<line>-start|run<n>|num`) for a skin to key on. */
export function colophonLinks(
  colophon: readonly ColophonLine[],
): ColophonLink[];
