/**
 * The rules every site's skins share, for a repo whose `fields/web_css.mjs`
 * and `fields/css.mjs` compose a field from them and the site's own rules.
 */
import {readFileSync} from "node:fs";
import {
  BODY_SIZE, PARAGRAPH_MARGIN, requireTheme,
} from "./email-blocks.mjs";
import {EMAIL_CHROME_HIDES, preludeEnd, WEB_CHROME_HIDES} from "./engine.mjs";

/** The shared web rules: base-web.css, which reads every value from the
 *  variables the site's TOKENS block defines. */
const WEB_BASE = readFileSync(
  new URL("./base-web.css", import.meta.url), "utf8",
);

/** WEB_CHROME_HIDES as rules. Important, so a site's own rules for the
 *  same elements can't show them unless those are important too. */
const WEB_HIDES = Object.keys(WEB_CHROME_HIDES)
  .map((selector) => `${selector} { display: none !important; }`)
  .join("\n");

/**
 * The web skin: the site's stylesheet with the shared rules inserted after
 * its opening comments and `@import`s, which must come before any rule,
 * and ahead of its own rules, so the site's win a tie.
 */
export function composeWebSkin(site) {
  const at = preludeEnd(site);
  const head = site.slice(0, at);
  return `${head}${head ? "\n\n" : ""}${WEB_BASE}\n${WEB_HIDES}\n`
    + site.slice(at);
}

/**
 * The shared email rules, in the site's email theme (see requireTheme), with
 * literal values: a mail client cannot resolve a CSS custom property, and
 * Buttondown inlines the stylesheet before sending. The site's own
 * stylesheet follows it: fonts it loads, its link colour, its button, its
 * quotations and its small print.
 */
export function emailBaseCss(theme) {
  requireTheme("emailBaseCss", theme);
  const {fonts, colours, leading} = theme;
  const hides = Object.keys(EMAIL_CHROME_HIDES)
    .map((selector) => `${selector} { display: none !important; }`);
  return [
    `body, td, div { font-family: ${fonts.body}; color: ${colours.ink}; `
      + `font-size: ${BODY_SIZE}; line-height: ${leading.body}; }`,
    // Buttondown inlines its own grey; important, so this is the last.
    `body { background-color: ${colours.page} !important; }`,
    // Unscoped, because the template rounds its card, its quotation and
    // whatever it adds next under class names of its own.
    "* { border-radius: 0 !important; }",
    // Forced, because the template styles the paragraph it wraps around
    // the content and wins on specificity.
    `p, li { font-family: ${fonts.body} !important; `
      + `color: ${colours.ink} !important; font-size: ${BODY_SIZE} !important; `
      + `line-height: ${leading.prose} !important; `
      + "font-weight: 400 !important; text-align: justify !important; "
      + "hyphens: auto; -webkit-hyphens: auto; -ms-hyphens: auto; }",
    `p { margin: ${PARAGRAPH_MARGIN}; }`,
    `ul, ol { margin: ${PARAGRAPH_MARGIN}; padding-left: 24px; `
      + `color: ${colours.ink}; font-size: ${BODY_SIZE} !important; }`,
    "li { margin: 0 0 6px 0; }",
    `h1, h2, h3, h4 { font-family: ${fonts.heading}; `
      + `color: ${colours.heading}; line-height: 1.2; `
      + "letter-spacing: -0.01em; margin: 32px 0 12px 0; }",
    // Smaller than a page's: read in a narrow pane under a subject the
    // reader has already seen.
    "h1 { font-size: 26px; font-weight: 700; line-height: 32px; }",
    "h2 { font-size: 20px; font-weight: 700; line-height: 28px; }",
    "h3 { font-size: 18px; line-height: 26px; }",
    // The template inlines a size and a heavier weight on the subject.
    "h1.subject, .newsletter-masthead h1 { font-size: 26px !important; "
      + "line-height: 32px !important; font-weight: 700 !important; }",
    `strong, b { font-weight: 600; color: ${colours.ink}; }`,
    "a { text-decoration: underline; text-decoration-thickness: 1px; "
      + "text-underline-offset: 0.15em; }",
    "hr { border: 0; margin: 32px 0; }",
    "blockquote { background: transparent !important; margin: 24px 0; }",
    // Longhands, because Buttondown emits its own border properties after
    // these and would override the shorthand.
    ".email-container { border-width: 0 !important; "
      + "border-style: none !important; "
      + `background-color: ${colours.page} !important; }`,
    ".newsletter-footer { border: 0 !important; "
      + "background: transparent !important; padding: 0 !important; "
      + "margin: 0 !important; }",
    ...hides,
  ].join("\n") + "\n\n";
}
