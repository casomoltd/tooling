/**
 * A site's design tokens copied into a file that can't read them: a
 * newsletter skin, a form's stylesheet. The values are read out of the
 * site's own stylesheet and written between two markers, so the copy is
 * generated and a check can tell when it has fallen behind.
 */

/** The line that closes every generated block, whichever file holds it. */
export const TOKENS_END = "/* END TOKENS */";

/** A CSS comment's delimiters. */
const COMMENT_OPEN = "/*";
const COMMENT_CLOSE = "*/";

/**
 * Comments removed by index rather than a lazy regex, which backtracks
 * between its two literals.
 * @param {string} text
 */
export function stripComments(text) {
  let out = "";
  let at = 0;
  for (;;) {
    const open = text.indexOf(COMMENT_OPEN, at);
    if (open === -1) return out + text.slice(at);
    out += text.slice(at, open);
    const close = text.indexOf(COMMENT_CLOSE, open + COMMENT_OPEN.length);
    if (close === -1) return out;
    at = close + COMMENT_CLOSE.length;
  }
}

/**
 * The value of one custom property, declared in a `:root` or `@theme` block:
 * a `.dark {}` or `@media` override elsewhere in the file is a variant, not
 * the token. Throws if absent, since a renamed token would otherwise leave a
 * stale copy behind.
 * @param {string} css
 * @param {string} name
 */
export function readToken(css, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const m of css.matchAll(new RegExp(`^\\s*${escaped}:\\s*([^;]+);`, "gm"))) {
    if (isBaseBlock(css, m.index)) return m[1].trim();
  }
  throw new Error(`${name} not found in a :root or @theme block`);
}

/**
 * The bounds of the one block between `start` and `end` in `text`; anything
 * else is refused, since a missing, repeated or reversed pair would slice the
 * wrong text.
 * @param {string} text
 * @param {{start: string, end: string, what: string}} markers
 */
export function findBlock(text, {start, end, what}) {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e < s
    || text.indexOf(start, s + 1) !== -1 || text.indexOf(end, e + 1) !== -1) {
    throw new Error(`${what} needs exactly one TOKENS block, start before end`);
  }
  return {s, e: e + end.length};
}

/**
 * The block: each target property set to the site token it is read from, the
 * token's name beside it, then any `extra` properties, whose value is read
 * from the tokens when it starts `--` and written as given otherwise.
 * @param {string} css the site's stylesheet
 * @param {readonly (readonly [string, string])[]} tokens target, then source
 * @param {{start: string, end: string}} markers
 * @param {readonly (readonly [string, string])[]} [extra] target, then value
 */
export function tokensBlock(css, tokens, {start, end}, extra = []) {
  return [
    start,
    ...tokens.map(([target, source]) =>
      `  ${target}: ${readToken(css, source)}; /* ${source} */`),
    ...extra.map(([target, value]) =>
      `  ${target}: ${value.startsWith("--") ? readToken(css, value) : value};`),
    end,
  ].join("\n");
}

/** Whether `index` sits directly in a top-level `:root` or `@theme` block:
 *  `:root.dark`, `:root[data-theme]` and a `:root` nested in an at-rule are
 *  variants of the token, not the token.
 *  @param {string} css @param {number} index */
function isBaseBlock(css, index) {
  const depth = [...css.slice(0, index)].reduce(
    (d, c) => d + Number(c === "{") - Number(c === "}"), 0,
  );
  const head = enclosing(css, index);
  return depth === 1 && (head === ":root" || /^@theme(\s|$)/.test(head));
}

/** The head of the block enclosing `index`, or "" at the top level. A comment
 *  before the head is not part of it, even one holding a `;`.
 *  @param {string} css @param {number} index */
function enclosing(css, index) {
  let depth = 0;
  for (let i = index; i >= 0; i -= 1) {
    if (css[i] === "}") depth += 1;
    if (css[i] === "{") {
      if (depth === 0) {
        const head = css.slice(0, i);
        const tail = head.slice(Math.max(head.lastIndexOf("}"),
          head.lastIndexOf(";"), head.lastIndexOf("{")) + 1);
        return stripComments(tail).replace(/^[\s\S]*\*\//, "").trim();
      }
      depth -= 1;
    }
  }
  return "";
}
