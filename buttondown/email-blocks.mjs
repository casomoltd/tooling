/**
 * The bands an email is built from, for a repo whose Buttondown emails
 * draw their own header and footer: the title on a ground, white air,
 * paragraphs, one action, a sign-off and the small print. The site
 * supplies its tokens, its mark band and its colophon; this supplies the
 * layout they share.
 *
 * Every rule is an inline `style` attribute, because inline is the only
 * thing every mail client honours, and vertical rhythm is carried on
 * table cell padding, because Outlook drops a margin on a table but
 * always honours padding on a cell. Every block ends with its own
 * trailing newlines, so a template is a plain concatenation.
 */

/** Buttondown re-emits these attributes in its own order when it inlines
 *  an email, so the opening tag is written once. */
export const TABLE =
  '<table role="presentation"\n'
  + '       cellpadding="0"\n'
  + '       cellspacing="0"\n'
  + '       border="0"\n'
  + '       width="100%"';

/** The body text size and a paragraph's spacing, the same in every band
 *  and in the shared email stylesheet. */
export const BODY_SIZE = "17px";
export const PARAGRAPH_MARGIN = "0 0 16px 0";

/** The template variables Buttondown fills with a subscriber's links. */
const UNSUBSCRIBE = '{{ unsubscribe_url }}';
const MANAGE = '{{ manage_subscription_url }}';

/**
 * The names an email theme must give, which `emailBaseCss` and
 * `createEmailBlocks` both read: one value per site, so a font or colour
 * has one producer.
 */
const THEME_PATHS = [
  "fonts.body", "fonts.heading", "colours.page", "colours.ink",
  "colours.heading", "leading.body", "leading.prose",
];

/** The paths in `paths` that `value` leaves undefined. */
export function missingPaths(value, paths) {
  return paths.filter((p) =>
    p.split(".").reduce((v, key) => v?.[key], value) === undefined);
}

/** Throws, naming each path missing, so a site states its whole look
 *  rather than rendering `undefined` into an email. */
export function requirePaths(what, value, paths) {
  const missing = missingPaths(value, paths);
  if (missing.length) throw new Error(`${what} needs ${missing.join(", ")}`);
}

/** Checks an email theme: {fonts: {body, heading}, colours: {page, ink,
 *  heading}, leading: {body, prose}}. */
export function requireTheme(what, theme) {
  requirePaths(what, {theme}, THEME_PATHS.map((p) => `theme.${p}`));
}

/**
 * The blocks for one site. Every option is required:
 *
 *   theme:   the site's email theme (see requireTheme): the body and
 *            heading fonts, the page, ink and heading colours, and the
 *            prose line height
 *   colours: {titleGround, action, actionInk, footerGround, footerRule}
 *   rhythm:  {cardPadding, buttonCell, buttonSize, buttonPadding,
 *             footerRuleWidth, footerCells: [top, bottom]}
 *   small:   the small print's inline style
 *   buttonClass: the class the email skin keys the button's rule on
 *   smallLink(href, text): a link in the small print
 *   colophon:  the small print's HTML, before the subscription sentence
 *   copyright: the last line's HTML
 *   sentenceBreak: what joins the colophon to the subscription sentence
 *   signoff:   the name a message is signed with
 */
export function createEmailBlocks(options = {}) {
  requireTheme("createEmailBlocks", options.theme);
  requirePaths("createEmailBlocks", options, [
    "colours.titleGround", "colours.action", "colours.actionInk",
    "colours.footerGround", "colours.footerRule", "rhythm.cardPadding",
    "rhythm.buttonCell", "rhythm.buttonSize", "rhythm.buttonPadding",
    "rhythm.footerRuleWidth", "rhythm.footerCells.0", "rhythm.footerCells.1",
    "small", "buttonClass", "smallLink", "colophon", "copyright",
    "sentenceBreak", "signoff",
  ]);
  const {
    theme, colours, rhythm, small, buttonClass, smallLink, colophon,
    copyright, sentenceBreak, signoff: name,
  } = options;

  /** A link inside the message: body-coloured and underlined, which
   *  leaves the action colour meaning "action". */
  function bodyLink(href, text) {
    return (
      `<a href="${href}" style="color:${theme.colours.ink};`
      + `text-decoration:underline;">${text}</a>`
    );
  }

  /** What the message is, on its own ground. */
  function card(title) {
    return (
      `${TABLE}\n`
      + `       style="background-color:${colours.titleGround};"><tr><td`
      + ` style="padding:${rhythm.cardPadding};"><div style="font-family:`
      + `${theme.fonts.heading};color:${theme.colours.heading};font-size:22px;`
      + "font-weight:700;line-height:28px;letter-spacing:-0.01em;\">"
      + `${title}</div></td></tr></table>\n\n`
    );
  }

  /** White air between bands: a cell with a height, because a margin on
   *  the table above would be dropped by several clients. */
  function spacer(height) {
    return (
      `${TABLE}\n`
      + `       style="background-color:${theme.colours.page};"><tr><td`
      + ` style="height:${height}px;line-height:${height}px;`
      + "font-size:0;\">&nbsp;</td></tr></table>\n\n"
    );
  }

  /** A paragraph of the message itself. */
  function p(html, margin = PARAGRAPH_MARGIN) {
    return (
      `<p style="font-family:${theme.fonts.body};color:${theme.colours.ink};`
      + `font-size:${BODY_SIZE};line-height:${theme.leading.prose};`
      + "font-weight:400;"
      + `margin:${margin};">${html}</p>\n\n`
    );
  }

  /** The one action, in its own cell so the space around it does not
   *  depend on the paragraph above collapsing its margin. */
  function button(href, label) {
    return (
      `${TABLE}><tr><td style="padding:${rhythm.buttonCell};">`
      + `<a class="${buttonClass}"\n`
      + `   href="${href}"\n`
      + `   style="font-family:${theme.fonts.body};display:inline-block;`
      + `background-color:${colours.action};`
      + `color:${colours.actionInk} !important;`
      + `font-size:${rhythm.buttonSize};font-weight:600;line-height:1.2;`
      + `padding:${rhythm.buttonPadding};text-decoration:none;">`
      + `<span style="color:${colours.actionInk} !important;">`
      + `${label}</span></a></td></tr></table>\n\n`
    );
  }

  /** Signed off, with room above so it reads as the end of the message
   *  rather than another paragraph of it. */
  function signoff() {
    return p(name, "24px 0 16px 0");
  }

  /**
   * The small print: the colophon, how to leave, and the copyright line.
   *
   * `subscription` is false on the confirmation and its reminder, where
   * there is no subscription yet to manage or leave. It has no default:
   * a repo hiding Buttondown's own unsubscribe line relies on this one,
   * so leaving it out by mistake would send an email with no way to
   * leave.
   */
  function footer({subscription} = {}) {
    if (typeof subscription !== "boolean") {
      throw new Error("footer() needs subscription: true or false");
    }
    const [top, bottom] = rhythm.footerCells;
    return (
      `${TABLE}\n`
      + "       style=\"margin-top:40px;"
      + `background-color:${colours.footerGround};\n`
      + `              border-top:${rhythm.footerRuleWidth} solid `
      + `${colours.footerRule};"><tr><td style="padding:${top};">`
      + `<div style="${small}">${colophon}`
      + (subscription
        ? `${sentenceBreak}You can ${smallLink(UNSUBSCRIBE, "unsubscribe")}`
          + ` or ${smallLink(MANAGE, "manage your subscription")}.`
        : "")
      + `</div></td></tr><tr><td style="padding:${bottom};">`
      + `<div style="${small}">${copyright}</div>`
      + "</td></tr></table>\n"
    );
  }

  return {bodyLink, button, card, footer, p, signoff, spacer};
}
