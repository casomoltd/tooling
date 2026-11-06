/**
 * The prose a reader sees on a Next.js page, read out of its JSX source and
 * the components it imports. Scoring that prose is `score.mjs`'s.
 */

import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/** Elements that sit inside a sentence rather than starting one: their
 *  text joins the block around them. Everything else is a block, whose
 *  text is a sentence or more of its own. Matched on the tag's own text,
 *  so a member tag (`<Foo.Link>`) counts as a block. */
const INLINE_TAGS = new Set([
  "a", "Link", "strong", "em", "b", "i", "u", "span", "code", "abbr",
  "sup", "sub", "small", "mark", "time", "br", "wbr",
]);

/** What an interpolated value reads as inside a sentence: a figure. */
const FIGURE = "1";

/** The shortest string literal read as prose: shorter ones are labels. */
const MIN_PROSE_CHARS = 20;

/** The share of a string's characters that must be letters for it to read
 *  as prose rather than path data, class names or a number table. */
const MIN_LETTER_SHARE = 0.6;

/** The fewest words a string must hold to read as prose: fewer is the
 *  fragment left when a JSX expression is cut out of a short line. */
const MIN_PROSE_WORDS = 3;

/** The import prefix that names the `src` directory. */
const SRC_ALIAS = "@/";

/** A run of at least two letters: the least that reads as a word. */
const HAS_WORD = /[A-Za-z]{2,}/;

/** Typographic entities, read as the characters they stand for. */
const ENTITIES = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&rsquo;": "\u2019", "&lsquo;": "\u2018", "&rdquo;": "\u201d",
  "&ldquo;": "\u201c", "&ndash;": "\u2013", "&mdash;": "\u2014",
  "&hellip;": "\u2026", "&#39;": "'", "&quot;": "\"",
};

/**
 * Prose a reader actually sees on a page, following the components it
 * imports.
 *
 * Import-following is the point: a page's score has to cover the
 * components it renders, not only what is written in its own file.
 *
 * Depth-limited and cycle-safe. Only project-local imports are
 * followed; a package's prose is not this site's prose.
 */
export function extractText(filePath, {maxDepth = 3} = {}) {
  const srcDir = srcDirOf(filePath);
  const seen = new Set();
  const collected = [];

  const walk = (file, depth) => {
    const resolved = path.resolve(file);
    if (seen.has(resolved) || depth > maxDepth) return;
    // Components only. A `.ts` module's strings are mostly data (role
    // lists, labels, the company statement) that the page shows only in
    // part or elsewhere, and many pages import the same module, so its
    // strings would grade each of those pages on text it barely shows.
    // The cost: prose a page renders from a `.ts` module goes unread.
    const importedNonComponent = depth > 0 && !resolved.endsWith(".tsx");
    if (importedNonComponent) return;
    seen.add(resolved);
    const sf = parseTsx(fs.readFileSync(resolved, "utf-8"), resolved);
    collected.push(...extractOwnText(sf));
    if (depth === maxDepth) return;
    for (const spec of importSpecifiers(sf)) {
      const target = resolveLocalImport(spec, resolved, srcDir);
      if (target) walk(target, depth + 1);
    }
  };
  walk(filePath, 0);

  // Terminate fragments so formulas count separate sentences
  const SENT_END = /[.!?]$/;
  const terminated = collected.map((t) =>
    SENT_END.test(t) ? t : t + "."
  );

  let text = terminated.join(" ");
  text = text.replace(/&#?\w+;/g, (entity) => ENTITIES[entity] ?? " ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/** Each page's route under an app-router directory, from its `page.tsx`
 *  files: `/` for the root page, `/<dir>` for the rest, sorted. */
export function discoverSlugs(srcAppDir) {
  const entries = fs.readdirSync(srcAppDir, {recursive: true});
  return entries
    .filter((e) => e.endsWith("page.tsx"))
    .map((e) => {
      const dir = path.dirname(e);
      return dir === "." ? "/" : `/${dir}`;
    })
    .sort();
}

// -------------------------------------------------------------------
// Following a file's imports and reading its prose
// -------------------------------------------------------------------

/**
 * Resolve a project-local import specifier to a file on disk.
 *
 * Relative (`./x`) and src-aliased (`@/x`) only. A bare specifier is a
 * package and is deliberately not followed: node_modules prose is not
 * this site's prose.
 */
function resolveLocalImport(spec, fromFile, srcDir) {
  let base;
  if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else if (spec.startsWith(SRC_ALIAS) && srcDir) {
    base = path.join(srcDir, spec.slice(SRC_ALIAS.length));
  } else {
    return null;
  }
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** The `src` directory a file sits under, for resolving `@/` imports. */
function srcDirOf(filePath) {
  const marker = `${path.sep}src${path.sep}`;
  const i = filePath.lastIndexOf(marker);
  return i === -1 ? null : filePath.slice(0, i + marker.length - 1);
}

/** A JSX file parsed, for its prose and its imports. */
function parseTsx(source, fileName) {
  return ts.createSourceFile(
    fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
}

/** The specifier of each import declaration, read from the parse rather
 *  than the text, so an import in a comment or a string is not followed. */
function importSpecifiers(sf) {
  return sf.statements
    .filter((s) => ts.isImportDeclaration(s)
      && ts.isStringLiteral(s.moduleSpecifier))
    .map((s) => s.moduleSpecifier.text);
}

function tagOf(sf, el) {
  const opening = ts.isJsxElement(el) ? el.openingElement : el;
  return opening.tagName.getText(sf);
}

function isInline(sf, el) {
  return (ts.isJsxElement(el) || ts.isJsxSelfClosingElement(el))
    && INLINE_TAGS.has(tagOf(sf, el));
}

/** The text a block reads as: its own text, its inline children's, and a
 *  figure for each interpolation. Block children are left out: the walk
 *  in `extractOwnText` scores each as its own block. */
function inlineText(sf, children) {
  return children.map((child) => {
    if (ts.isJsxText(child)) return child.text;
    if (ts.isJsxExpression(child)) {
      return child.expression ? expressionText(sf, child.expression) : "";
    }
    if (isInline(sf, child)) {
      return ts.isJsxElement(child) ? inlineText(sf, child.children) : " ";
    }
    return "";
  }).join("");
}

/** What an interpolation reads as. A string is its text; a conditional
 *  reads as its first branch, the one a reader sees by default; inline JSX
 *  joins the sentence; block JSX is scored on its own; anything else is a
 *  value, read as a figure. */
function expressionText(sf, e) {
  if (ts.isParenthesizedExpression(e)) return expressionText(sf, e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return e.text;
  }
  if (ts.isConditionalExpression(e)) return expressionText(sf, e.whenTrue);
  if (ts.isBinaryExpression(e)
    && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return expressionText(sf, e.right);
  }
  if (isInline(sf, e)) {
    return ts.isJsxElement(e) ? inlineText(sf, e.children) : " ";
  }
  return containsJsx(e) ? "" : ` ${FIGURE} `;
}

function containsJsx(node) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)
    || ts.isJsxFragment(node)) {
    return true;
  }
  return ts.forEachChild(node, containsJsx) ?? false;
}

/** A run of strings joined with `+`, read as the one sentence it is. */
function stringOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans
      .map((span) => ` ${FIGURE} ${span.literal.text}`).join("");
  }
  if (ts.isParenthesizedExpression(node)) return stringOf(node.expression);
  if (ts.isBinaryExpression(node)
    && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = stringOf(node.left);
    const right = stringOf(node.right);
    return left === null || right === null ? null : left + right;
  }
  return null;
}

/**
 * Prose lifted from ONE parsed file's JSX, without following its imports.
 *
 * Parsed, because a JSX file is mostly code and code is full of `<` and
 * `>` (generics, arrow functions, comparisons): only a parser can tell
 * JSX text from it. What comes back is each block's text, with its links
 * and emphasis folded into the sentence they sit in and each
 * interpolated value read as a figure, plus string literals that read as
 * prose. Those include attribute values, because a component's
 * `description="…"` is copy on the page, and they also include strings a
 * reader never sees (a metadata title, an error message): an
 * approximation of what the page shows, close enough to grade it.
 */
function extractOwnText(sf) {
  const out = [];
  const visit = (node) => {
    const isBlock = (ts.isJsxElement(node) && !isInline(sf, node))
      || ts.isJsxFragment(node);
    if (isBlock) {
      const text = inlineText(sf, node.children).replace(/\s+/g, " ").trim();
      if (HAS_WORD.test(text)) out.push(text);
    } else {
      const text = stringOf(node);
      if (text !== null) {
        const prose = text.replace(/\s+/g, " ").trim();
        const readsAsProse = /^[A-Z]/.test(prose)
          && prose.length > MIN_PROSE_CHARS && isProse(prose);
        if (readsAsProse) out.push(prose);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * Whether a string is prose a reader would read, rather than data that
 * happens to live in a string.
 *
 * Two tests, both cheap. It must be mostly letters — path data,
 * class-name soup and number tables are not — and it must be more than
 * a couple of words, which drops the fragments left behind when a JSX
 * expression is stripped out of a short line.
 */
function isProse(text) {
  const compact = text.replace(/\s+/g, "");
  if (compact.length === 0) return false;
  const letters = (compact.match(/[A-Za-z]/g) ?? []).length;
  if (letters / compact.length < MIN_LETTER_SHARE) return false;
  const words = text.split(/\s+/).filter((w) => HAS_WORD.test(w));
  return words.length >= MIN_PROSE_WORDS;
}
