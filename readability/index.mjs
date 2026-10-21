/**
 * Readability scoring for Next.js page content.
 *
 * Extracts prose from JSX source files and computes scores
 * against 7 readability formulas. Designed to be called from
 * the CLI wrapper or programmatically.
 */

import rs from "text-readability";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_MAX_GRADE = 12;

export const DEFAULT_WORD_SUBS = {
  calculators: "tools",
  calculator: "tool",
};

const IMPORT_RE = /import\s+(?:type\s+)?(?:[\w*{},\s]+from\s+)?["']([^"']+)["']/g;

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

/** A run of at least two letters: the least that reads as a word. */
const HAS_WORD = /[A-Za-z]{2,}/;

/** Typographic entities, read as the characters they stand for. */
const ENTITIES = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&rsquo;": "\u2019", "&lsquo;": "\u2018", "&rdquo;": "\u201d",
  "&ldquo;": "\u201c", "&ndash;": "\u2013", "&mdash;": "\u2014",
  "&hellip;": "\u2026", "&#39;": "'", "&quot;": "\"",
};

// -------------------------------------------------------------------
// Discover page slugs from an app-router directory
// -------------------------------------------------------------------

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
// Extract prose text from a page.tsx source file
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
  } else if (spec.startsWith("@/") && srcDir) {
    base = path.join(srcDir, spec.slice(2));
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

/**
 * Prose lifted from ONE file's JSX, without following its imports.
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
function extractOwnText(source, fileName) {
  const sf = ts.createSourceFile(
    fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
  const out = [];

  const tagOf = (el) => {
    const opening = ts.isJsxElement(el) ? el.openingElement : el;
    return opening.tagName.getText(sf);
  };
  const isInline = (el) =>
    (ts.isJsxElement(el) || ts.isJsxSelfClosingElement(el))
    && INLINE_TAGS.has(tagOf(el));

  // The text a block reads as: its own text, its inline children's,
  // and a figure for each interpolation. Block children are left out:
  // the walk below scores each as its own block.
  const inlineText = (children) => children.map((child) => {
    if (ts.isJsxText(child)) return child.text;
    if (ts.isJsxExpression(child)) {
      return child.expression ? expressionText(child.expression) : "";
    }
    if (isInline(child)) {
      return ts.isJsxElement(child) ? inlineText(child.children) : " ";
    }
    return "";
  }).join("");

  // What an interpolation reads as. A string is its text; a conditional
  // reads as its first branch, the one a reader sees by default; inline
  // JSX joins the sentence; block JSX is scored on its own by the walk
  // below; anything else is a value, read as a figure.
  const expressionText = (e) => {
    if (ts.isParenthesizedExpression(e)) return expressionText(e.expression);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      return e.text;
    }
    if (ts.isConditionalExpression(e)) return expressionText(e.whenTrue);
    if (ts.isBinaryExpression(e)
      && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return expressionText(e.right);
    }
    if (isInline(e)) {
      return ts.isJsxElement(e) ? inlineText(e.children) : " ";
    }
    return containsJsx(e) ? "" : ` ${FIGURE} `;
  };

  const containsJsx = (node) => {
    let found = false;
    const look = (n) => {
      if (found) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)
        || ts.isJsxFragment(n)) {
        found = true;
        return;
      }
      ts.forEachChild(n, look);
    };
    look(node);
    return found;
  };

  // A run of strings joined with `+`, read as the one sentence it is.
  const stringOf = (node) => {
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
  };

  const visit = (node) => {
    const isBlock = (ts.isJsxElement(node) && !isInline(node))
      || ts.isJsxFragment(node);
    if (isBlock) {
      const text = inlineText(node.children).replace(/\s+/g, " ").trim();
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
  if (letters / compact.length < 0.6) return false;
  const words = text.split(/\s+/).filter((w) => HAS_WORD.test(w));
  return words.length >= 3;
}

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
    // part or elsewhere, and scoring them graded every page on the same
    // shared lists. The cost: prose a page renders from a `.ts` module
    // goes unread.
    const importedNonComponent = depth > 0 && !resolved.endsWith(".tsx");
    if (importedNonComponent) return;
    seen.add(resolved);
    const source = fs.readFileSync(resolved, "utf-8");
    collected.push(...extractOwnText(source, resolved));
    if (depth === maxDepth) return;
    for (const m of source.matchAll(IMPORT_RE)) {
      const target = resolveLocalImport(m[1], resolved, srcDir);
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

// -------------------------------------------------------------------
// Compute readability scores
// -------------------------------------------------------------------

function round(n) {
  return Math.round(n * 10) / 10;
}

function applyWordSubs(text, wordSubs) {
  let out = text;
  for (const [word, sub] of Object.entries(wordSubs)) {
    out = out.replace(
      new RegExp(`\\b${word}\\b`, "gi"),
      sub,
    );
  }
  return out;
}

/**
 * The floor below which the formulas are not meaningful.
 *
 * A page under it is UNSCORED, not passing: a score that measured
 * nothing is not evidence the page reads well.
 */
export const MIN_SCORABLE_WORDS = 100;

export function scoreText(text, wordSubs = DEFAULT_WORD_SUBS) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SCORABLE_WORDS) {
    return {
      wordCount,
      scores: null,
      consensusGrade: null,
      unscored: true,
    };
  }
  const normalized = applyWordSubs(text, wordSubs);
  const scores = {
    fleschReadingEase: round(
      rs.fleschReadingEase(normalized),
    ),
    fleschKincaidGrade: round(
      rs.fleschKincaidGrade(normalized),
    ),
    gunningFog: round(rs.gunningFog(normalized)),
    colemanLiau: round(rs.colemanLiauIndex(normalized)),
    smog: round(rs.smogIndex(normalized)),
    ari: round(
      rs.automatedReadabilityIndex(normalized),
    ),
    daleChall: round(
      rs.daleChallReadabilityScore(normalized),
    ),
  };
  const gradeScores = [
    scores.fleschKincaidGrade,
    scores.gunningFog,
    scores.colemanLiau,
    scores.smog,
    scores.ari,
  ];
  gradeScores.sort((a, b) => a - b);
  const consensusGrade = round(
    gradeScores[Math.floor(gradeScores.length / 2)],
  );
  return {wordCount, scores, consensusGrade};
}

// -------------------------------------------------------------------
// Pretty-print a human-readable table
// -------------------------------------------------------------------

function pad(n) {
  return n == null ? "N/A" : String(n).padStart(6);
}

export function formatPretty(results, threshold) {
  const lines = [];
  for (const r of results.pages) {
    const status = r.pass ? "PASS" : "FAIL";
    lines.push(`\n${status}  ${r.slug}`);
    lines.push("─".repeat(44));
    if (!r.scores) {
      lines.push("  (too few words to score)");
      continue;
    }
    lines.push(
      `  Flesch Reading Ease   ${pad(r.scores.fleschReadingEase)}`,
    );
    lines.push(
      `  Flesch-Kincaid Grade  ${pad(r.scores.fleschKincaidGrade)}`,
    );
    lines.push(
      `  Gunning Fog           ${pad(r.scores.gunningFog)}`,
    );
    lines.push(
      `  Coleman-Liau          ${pad(r.scores.colemanLiau)}`,
    );
    lines.push(
      `  SMOG                  ${pad(r.scores.smog)}`,
    );
    lines.push(
      `  ARI                   ${pad(r.scores.ari)}`,
    );
    lines.push(
      `  Dale-Chall            ${pad(r.scores.daleChall)}`,
    );
    lines.push("─".repeat(44));
    lines.push(
      `  Consensus Grade Level ${pad(r.consensusGrade)}`,
    );
    lines.push(
      `  Word Count            ${r.wordCount.toLocaleString()}`,
    );
  }
  lines.push(
    `\nThreshold: grade ${threshold.maxGrade} | ` +
      `${results.allPassed ? "All passed" : "FAILURES DETECTED"}`,
  );
  return lines.join("\n");
}
