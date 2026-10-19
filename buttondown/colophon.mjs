/**
 * A site's colophon as Buttondown `socials` links, for a footer that
 * says what the site's footer says. Buttondown draws `socials` only as
 * links, and caps each label (docs/buttondown-platform.md, The API), so
 * a colophon line arrives as several links that a skin sets as one line
 * of text.
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
    const {text, register, source} = entry;
    if (text.endsWith(".")) {
      throw new Error(`colophon line "${text}": leave off the full stop`);
    }
    if (register && !(register.url && register.number)) {
      throw new Error(`colophon line "${text}": register needs url and number`);
    }
    const url = register ? register.url : source;
    if (!url) throw new Error(`colophon line "${text}" links nowhere`);
    const at = (part) => {
      const marked = new URL(url);
      if (!["http:", "https:"].includes(marked.protocol)) {
        throw new Error(`colophon line "${text}": ${url} isn't http(s)`);
      }
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
