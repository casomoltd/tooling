#!/usr/bin/env node
/**
 * Check one HTML design spec's mechanics, so the authoring skill does not
 * have to teach them.
 *
 * These rules are measurements -- a width budget, a contiguous figure
 * sequence, a resolving anchor -- so they belong in a command. What stays in
 * the skill is the half no tool can apply: what to draw, and whether it is
 * worth drawing.
 *
 * Exits non-zero on the first failing rule set, listing every instance.
 *
 *   node bin/spec-check.mjs <spec.html>
 */
import { readFileSync } from 'node:fs';
import { FIGURE_WIDTH_BUDGET } from './utils.mjs';

const file = process.argv[2];
if (!file) throw new Error('usage: spec-check.mjs <spec.html>');
const html = readFileSync(file, 'utf8');

/** A pre-rendered figure is hundreds of kilobytes of inline SVG carrying its
 *  own ids, and a figure's mermaid source sits in an HTML comment above it.
 *  Neither is the document, so an id in either must not answer one of the
 *  document's links, and neither may be counted as an anchor a reader has. */
const doc = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<svg[\s\S]*?<\/svg>/g, '');

const findings = [];
const fail = (rule, detail) => findings.push({ rule, detail });
const all = (re, s = html) => [...s.matchAll(re)];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const text = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// --- anchors -------------------------------------------------------------
const ids = new Set(all(/\sid="([^"]+)"/g, doc).map((m) => m[1]));
for (const m of all(/href="#([^"]+)"/g, doc)) {
  if (!ids.has(m[1])) fail('anchor', `href="#${m[1]}" resolves to nothing`);
}

// --- contents against the headings ---------------------------------------
const nav = doc.match(/<nav class="toc">([\s\S]*?)<\/nav>/);
if (!nav) fail('toc', 'no <nav class="toc">');
else {
  // Parsed from inside the nav, not filtered out of the whole document: once
  // prose cites a section by name, a body link and a contents entry are the
  // same markup, and a filter counts both.
  //
  // Both sides capture markup and are reduced to text, so a heading carrying
  // a <code> span stays in the comparison. Matching bare text instead drops
  // such a heading from BOTH sets, which leaves the counts equal and the
  // mismatch never compared.
  const labels = [...nav[1].matchAll(/<a href="#[^"]+"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => text(m[1]));
  const heads = all(/<h2[^>]*>([\s\S]*?)<\/h2>/g, doc).map((m) => text(m[1]));
  if (labels.length !== heads.length) {
    fail('toc', `${labels.length} entries against ${heads.length} sections`);
  } else {
    labels.forEach((l, i) => {
      if (l !== heads[i]) fail('toc', `entry "${l}" against heading "${heads[i]}"`);
    });
  }
}

// --- S11: the masthead carries no loose prose ----------------------------
// The Overview & goals card is the document's summary. A standfirst above it
// says the same thing a second time, and belongs to no section, so it is the
// copy that goes stale unread. Everything else in the masthead -- eyebrow,
// title, contents, status pills -- is not a paragraph, so a <p> left after
// the nav and the card are removed is the defect.
const hero = doc.match(/<header[^>]*class="hero"[\s\S]*?<\/header>/);
if (hero) {
  const loose = hero[0]
    .replace(/<nav[\s\S]*?<\/nav>/g, '')
    .replace(/<section[\s\S]*?<\/section>/g, '');
  // Prose, not `<p>`: the standfirst this rule exists to catch was carried as
  // a non-paragraph element, so keying on the tag let the exact defect past.
  for (const m of loose.matchAll(/<(?:p|div)\b[^>]*>([\s\S]*?)<\/(?:p|div)>/g)) {
    if (/\bclass="[^"]*\b(?:eyebrow|pillrow|pill|wrap)\b/.test(m[0])) continue;
    const words = text(m[1]);
    if (!words) continue;
    fail('masthead', `prose sits in the masthead outside the Overview card: `
      + `"${words.slice(0, 60)}…" (S11)`);
  }
}

// --- no typed numbers: the stylesheet generates them -------------------
for (const m of all(/<h[23][^>]*>\s*(\d+(?:\.\d+)?)\s*(?:&middot;|·)/g, doc)) {
  fail('numbering', `a heading types "${m[1]}"; section numbers are generated`);
}
const TYPED_TOC = /<a href="#[^"]+"[^>]*>\s*(\d+(?:\.\d+)?)\s*(?:&middot;|·)/g;
for (const m of all(TYPED_TOC, doc)) {
  fail('numbering', `a contents entry types "${m[1]}"; numbers are generated`);
}
for (const m of all(/(?:&sect;|§)\d+(?:\.\d+)?/g, doc)) {
  fail('numbering', `prose cites "${m[0]}" by number; cite the section by name`);
}

// --- figures: numbered, anchored, captioned, and inside the budget -------
const figs = all(/<div\b[^>]*\bid="fig-(\d+)"[^>]*>/g);
figs.forEach((m, i) => {
  const n = Number(m[1]);
  if (n !== i + 1) {
    fail('figure', i === 0 ? `expected fig-1, found fig-${n}`
      : `fig-${n} follows fig-${figs[i - 1][1]}`);
  }
  if (!m[0].includes('scroll-margin-top')) {
    fail('figure', `fig-${n} has no scroll-margin-top, so host chrome can cover it`);
  }
  // Bounded by what comes next rather than by a character count: a
  // pre-rendered figure is hundreds of kilobytes of inline SVG, so a window
  // wide enough to clear one is wide enough to borrow the next figure's
  // caption and call every figure captioned.
  const from = m.index + m[0].length;
  const nextFig = figs[i + 1]?.index ?? -1;
  const nextSec = html.indexOf('</section>', from);
  const ends = [nextFig, nextSec].filter((x) => x !== -1);
  const between = html.slice(from, ends.length ? Math.min(...ends) : html.length);
  if (!/<(?:div|p)\b[^>]*\bclass="[^"]*\blegend\b/.test(between)) {
    fail('caption', `fig-${n} has no legend before the next figure or section end`);
  }
});

// Mermaid emits `viewBox="-8 -8 W H"` on the figure, while every arrowhead
// marker inside it carries its own `viewBox="0 0 10 10"`. So the figure is
// found by the id the renderer assigns, and the width read as the third
// value whatever the origin.
//
// The cardinality check is the load-bearing half. A width rule that matches
// nothing reports nothing, so an unrendered spec, or one figure whose render
// failed, would otherwise be certified clean by a measurement that never ran.
const svgTags = all(/<svg\b[^>]*\bid="fig-svg-\d+"[^>]*>/g).map((m) => m[0]);
if (svgTags.length !== figs.length) {
  fail('figure', `${figs.length} figure(s) but ${svgTags.length} rendered svg(s); `
    + 'run render-figures.mjs');
}
svgTags.forEach((tag, i) => {
  const vb = tag.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)/);
  if (!vb) {
    fail('width', `fig-${i + 1} rendered without a parsable viewBox`);
    return;
  }
  const w = Math.round(Number(vb[1]));
  if (w > FIGURE_WIDTH_BUDGET) {
    fail('width',
      `fig-${i + 1} renders ${w}px against a ${FIGURE_WIDTH_BUDGET}px budget`);
  }
});

// --- things that only fail once the host renders the page ----------------
if (/<pre[^>]*class="[^"]*\bmermaid\b/.test(html)) {
  fail('runtime', 'a <pre class="mermaid"> is present; the artifact host claims it '
    + 'and renames the svg, so every fill falls back to black. Pre-render instead.');
}
if (html.includes('Syntax error in text')) {
  fail('render', 'a rendered figure carries mermaid\'s syntax-error text');
}

// A mermaid click directive compiles to one of two things. `call fn()` and the
// bare-callback form become inline JS, which the host CSP drops. `href "#a"`
// becomes an ordinary <a> in the SVG, which works. So a call is refused, and
// an href has to be findable on that node in the pre-rendered output -- which
// also catches a directive naming a node no longer in the diagram.
//
// The node id is matched loosely and the remainder classified, so a spelling
// this does not know becomes a finding rather than a skip: the rule exists to
// ban inline JS, and a pattern that only recognises one spelling of it lets
// the rest through silently.
const svgs = all(/<svg\b[^>]*\bid="fig-svg-\d+"[\s\S]*?<\/svg>/g).map((m) => m[0]);
for (const m of all(/^[ \t]*click\s+(\S+)\s+(.*)$/gm)) {
  const [, node, rest] = m;
  const href = rest.match(/^(?:href\s+)?"([^"]+)"/);
  if (/^call\b/.test(rest)) {
    fail('click',
      `click ${node} ${rest.trim()} is inline JS, which the host CSP blocks`);
  } else if (!href) {
    fail('click', `click ${node} ${rest.trim()} is not an href; a bare callback is `
      + 'inline JS, which the host CSP blocks');
  } else if (!svgs.some((svg) => {
    // Find the anchor by the node it wraps, then assert the attribute on that
    // tag. Searching for `href="…"` alone matches the tail of `xlink:href`,
    // so it would pass on the deprecated attribute and never see the one the
    // renderer adds.
    const tag = svg.match(new RegExp(`<a\\b[^>]*\\bdata-id="${esc(node)}"[^>]*>`));
    return tag && new RegExp(`(^|\\s)href="${esc(href[1])}"`).test(tag[0]);
  })) {
    fail('click', `click ${node} href ${href[1]} did not survive pre-rendering`);
  }
}

// Matched as a whole tag, then read attribute by attribute: requiring `rel`
// before `href` let a reordered link through, and a missed blocked stylesheet
// is the direction that fails open.
for (const m of all(/<link\b[^>]*>/g, doc)) {
  if (!/\brel="[^"]*\bstylesheet\b/.test(m[0])) continue;
  const href = m[0].match(/\bhref="([^"]+)"/);
  if (!href || !/^https?:/.test(href[1])) continue;
  let host = null;
  try { host = new URL(href[1]).host; } catch { /* foreign by default */ }
  if (host !== 'fonts.googleapis.com') {
    fail('csp', `${href[1]} is blocked by the host CSP; inline it`);
  }
}

// --- open questions ------------------------------------------------------
const qs = all(/<tr id="q(\d+)"/g, doc).map((m) => Number(m[1]));
qs.forEach((n, i) => {
  if (n !== i + 1) {
    fail('questions', i === 0 ? `expected Q1, found Q${n}`
      : `Q${n} follows Q${qs[i - 1]}`);
  }
});

// --- report --------------------------------------------------------------
if (findings.length === 0) {
  const n = figs.length;
  const s = n === 1 ? '' : 's';
  console.log(`spec-check: clean (${ids.size} anchors, ${n} figure${s})`);
  process.exit(0);
}
const byRule = new Map();
for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) || []), f.detail]);
for (const [rule, details] of byRule) {
  console.error(`\n${rule}:`);
  for (const d of details) console.error(`  - ${d}`);
}
console.error(`\nspec-check: ${findings.length} finding(s) in ${file}`);
process.exit(1);
