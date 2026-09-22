#!/usr/bin/env node
/**
 * Re-render a spec's mermaid figures to static inline SVG.
 *
 * The spec embeds rendered SVG rather than a mermaid runtime, because the
 * artifact viewer ships its own runtime that claims every `pre.mermaid` and
 * renames the svg it produces. Mermaid scopes a diagram's fills to the svg's
 * own id, so a rename leaves those rules matching nothing and every shape
 * falls back to the default fill, which is black. Embedding removes both the
 * race and the id dependency.
 *
 * Each figure keeps its source in an HTML comment directly above it. This
 * reads those back, renders them, freezes the computed paint inline, and
 * writes the file in place.
 *
 *   node bin/render-figures.mjs <spec.html>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { FIGURE_WIDTH_BUDGET } from './utils.mjs';

/** Playwright is a heavy prerequisite this package deliberately does not
 *  declare, because a declared optional peer resolves into every consumer's
 *  lockfile. So it is resolved from the calling project rather than from
 *  here, and RENDER_FIGURES_RESOLVE_FROM names that project when the working
 *  directory is not it. */
const from = resolve(process.env.RENDER_FIGURES_RESOLVE_FROM || process.cwd());
let chromium;
try {
  ({ chromium } = createRequire(`${from}/`)('playwright'));
} catch {
  throw new Error('playwright is not installed — add it as a devDependency'
    + ' (npm i -D playwright && npx playwright install chromium) in the project'
    + ` you are rendering from, or point RENDER_FIGURES_RESOLVE_FROM at one`
    + ` that has it. Looked in ${from}.`);
}

/** The marker above each figure, as one producer: it is both searched for
 *  and written back, so the two must be the same string. */
const MARKER = '  <!-- figure source, regenerate with bin/render-figures.mjs:';
const SOURCE = new RegExp(`${MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  + '\n([\\s\\S]*?)\n  -->\n  <div class="figure-card">[\\s\\S]*?<\\/div>\n', 'g');

/** Written even when they compute to `none`: an arrowhead that silently gains
 *  a fill is the same defect as a box that silently loses one. */
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'color'];

const file = process.argv[2];
if (!file) throw new Error('usage: render-figures.mjs <spec.html>');

const html = readFileSync(file, 'utf8');
// An HTML comment ends at the first `-->`, so a mermaid arrow written whole
// would close the comment and truncate the source. The spec writes `- ->`
// and this puts it back.
const sources = [...html.matchAll(SOURCE)].map((m) => m[1].replaceAll('- -', '--'));
// Counted against the figures rather than against zero: one malformed marker
// leaves that figure holding a stale SVG while the run still reports success.
const figures = [...html.matchAll(/<div\b[^>]*\bid="fig-\d+"/g)].length;
if (sources.length !== figures) {
  throw new Error(`${figures} figure(s) in ${file} but ${sources.length} source`
    + ' comment(s); a figure marker is malformed or missing');
}

/** A multi-line node label is what overflows a box: mermaid sizes a
 *  foreignObject from the first line and the rest spills below it. The rubric
 *  already says keep labels short and put the detail in the legend (M10); this
 *  is that rule where it can actually be measured. */
for (const [i, src] of sources.entries()) {
  const multi = [...src.matchAll(/\[".*?<br\s*\/?>.*?"\]/g)].length;
  if (multi) {
    console.warn(`figure ${i + 1}: ${multi} node label(s) span more than one`
      + ' line and will overflow their box — shorten them, per diagram-rubric M10');
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
// The font must be LOADED, not just named: mermaid measures every label to
// size its box, so rendering against a fallback and publishing against IBM
// Plex Sans puts wider text into boxes cut for narrower text. Every figure
// overflows slightly, and it looks like a mermaid bug rather than a missing
// stylesheet.
const FONT = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans'
  + ':ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
const STACK = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
await page.setContent(`<!doctype html><html><head>
  <link rel="stylesheet" href="${FONT}">
  <style>body { font-family: ${STACK}; }</style>
  <script src="${MERMAID}"><\/script>
  </head><body>${sources.map((s) => {
    const escaped = s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    return `<pre class="m">${escaped}</pre>`;
  }).join('')}</body></html>`);
await page.waitForFunction(() => typeof window.mermaid !== 'undefined');
await page.evaluate(() => document.fonts.load('600 15px "IBM Plex Sans"')
  .then(() => document.fonts.ready));

const rendered = await page.evaluate(async (paint) => {
  window.mermaid.initialize({
    startOnLoad: false, theme: 'neutral', securityLevel: 'loose',
    themeVariables: {
      fontSize: '15px',
      fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
      textColor: '#1f2530', primaryTextColor: '#1f2530', nodeTextColor: '#1f2530',
      titleColor: '#1f2530', clusterBkg: '#f7f8fa', clusterBorder: '#b9c0cb',
      lineColor: '#5b6472',
    },
    flowchart: { htmlLabels: true, useMaxWidth: false },
    class: { useMaxWidth: false },
  });
  const out = [];
  const nodes = [...document.querySelectorAll('pre.m')];
  for (const [i, el] of nodes.entries()) {
    const { svg } = await window.mermaid.render(`fig-svg-${i}`, el.textContent);
    const holder = document.createElement('div');
    holder.innerHTML = svg;
    document.body.appendChild(holder);
    const node = holder.querySelector('svg');
    node.querySelectorAll('*').forEach((child) => {
      const cs = getComputedStyle(child);
      paint.forEach((prop) => {
        const v = cs.getPropertyValue(prop);
        if (v) child.style.setProperty(prop, v);
      });
    });
    // Mermaid emits only the deprecated xlink:href on a click-through link.
    // Every current browser still honours it, but SVG2 names the attribute
    // `href`, so write both and let the newer one win.
    node.querySelectorAll('a[*|href]').forEach((a) => {
      const x = a.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (x && !a.getAttribute('href')) a.setAttribute('href', x);
    });
    node.setAttribute('style', 'max-width:100%;height:auto');
    out.push({ svg: node.outerHTML, viewBox: node.getAttribute('viewBox') });
  }
  return out;
}, PAINT);
await browser.close();

let n = 0;
const next = html.replace(SOURCE, (whole, src) => {
  const { svg } = rendered[n++];
  return `${MARKER}\n${src}\n  -->\n  <div class="figure-card">${svg}</div>\n`;
});
writeFileSync(file, next);

// Producing a measurable figure is this script's job, so one it cannot
// measure is a failure rather than a figure reported as zero pixels wide.
rendered.forEach(({ viewBox }, i) => {
  const parsed = /^[-\d.]+\s+[-\d.]+\s+([\d.]+)/.exec(viewBox || '');
  if (!parsed) throw new Error(`figure ${i + 1} rendered without a usable viewBox`);
  const w = Math.round(Number(parsed[1]));
  const over = w > FIGURE_WIDTH_BUDGET
    ? `  ** OVER the ${FIGURE_WIDTH_BUDGET}px budget **` : '';
  console.log(`figure ${i + 1}: ${w}px${over}`);
});
console.log(`wrote ${n} figures to ${file}`);
