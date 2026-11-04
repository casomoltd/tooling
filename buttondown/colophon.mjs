/**
 * A site's colophon as Buttondown draws it, for a footer that says what
 * the site's footer says: as `socials` links for the blog, and as HTML
 * for an email. Buttondown draws `socials` only as links, and caps each
 * label (docs/buttondown-platform.md, The API), so a colophon line
 * arrives there as several links that a skin sets as one line of text.
 */

/** Buttondown's limit on a `socials` label, and the only `socials` type
 *  that carries a label of our own. */
export const SOCIALS_LABEL_MAX = 32;
const GENERIC = "generic";

/** The query a skin keys on, and its parts: `<line>-<part>`. */
const MARK = "colophon";
const START = "start";
const RUN = "run";
const NUMBER = "num";

/**
 * The links for each colophon line: its text in runs that fit a label,
 * then, for a line with a register, the register's number with the full
 * stop (one label, so the stop can't wrap away from it); a line with a
 * source gets the full stop on its text instead. A line is `{text,
 * register: {number, url}}` or `{text, source}`, its text written
 * without the closing full stop; every run links to the register, or to
 * the source where a line without one is explained or published.
 *
 * Each URL carries a `colophon` query, `<line>-<part>`: `start` begins a
 * line, `num` is the number, and `run<n>` the rest of the line's text. A
 * query rather than a fragment, so a link to a section keeps its anchor.
 */
export function colophonLinks(colophon) {
  return colophon.flatMap((entry, line) => {
    const {text, register, url} = checkedLine(entry);
    const at = (part) => {
      const marked = new URL(url);
      marked.searchParams.set(MARK, `${line}-${part}`);
      return marked.href;
    };
    const runs = labelRuns(register ? text : `${text}.`);
    return [
      ...runs.map((label, i) => ({
        type: GENERIC, url: at(i === 0 ? START : `${RUN}${i}`), label,
      })),
      ...(register
        ? [{type: GENERIC, url: at(NUMBER), label: `${register.number}.`}]
        : []),
    ];
  });
}

/**
 * The colophon as an email's small print, a line each: a register's number
 * linked to the register, or a line with no register linked whole to its
 * source, each with its full stop. A bare street and postcode would
 * otherwise be turned by a mail app into a map link in its own colour; an
 * address that is already a link it leaves alone. `link(href, text)` draws
 * a link in the site's own style. A line's text goes into the HTML as
 * written: a colophon is the site's own constants, not a reader's input, so
 * nothing here escapes it.
 */
export function colophonHtml(colophon, link) {
  return colophon.map((entry) => {
    const {text, register, url} = checkedLine(entry);
    return register
      ? `${text} ${link(url, register.number)}.`
      : `${link(url, text)}.`;
  }).join("<br>");
}

/**
 * A colophon line, checked as every output needs it: its text without the
 * closing full stop, and a link to an http(s) address, the register's (with
 * its number) or the line's source.
 */
function checkedLine({text, register, source}) {
  if (text.endsWith(".")) {
    throw new Error(`colophon line "${text}": leave off the full stop`);
  }
  if (register && !(register.url && register.number)) {
    throw new Error(`colophon line "${text}": register needs url and number`);
  }
  const url = register ? register.url : source;
  if (!url) throw new Error(`colophon line "${text}" links nowhere`);
  if (!["http:", "https:"].includes(new URL(url).protocol)) {
    throw new Error(`colophon line "${text}": ${url} isn't http(s)`);
  }
  return {text, register, url};
}

/** `text` split at spaces into runs of at most SOCIALS_LABEL_MAX
 *  characters; throws on a word longer than that, which no run holds. */
export function labelRuns(text) {
  const out = [];
  for (const word of text.split(" ")) {
    const last = out.at(-1);
    if (last && `${last} ${word}`.length <= SOCIALS_LABEL_MAX) {
      out[out.length - 1] = `${last} ${word}`;
    } else {
      if (word.length > SOCIALS_LABEL_MAX) {
        throw new Error(`no socials label fits "${word}"`);
      }
      out.push(word);
    }
  }
  return out;
}
