#!/usr/bin/env node

/**
 * Render a markdown + mermaid report to a self-contained HTML page — the
 * renderer for agent reports (docs-xray, design-xray), whose mermaid diagrams
 * render unreliably in editor previews. The page is meant to be published as
 * an artifact by the caller; the agents themselves cannot publish.
 *
 * Two properties the output depends on, both learned the hard way.
 *
 * The markdown is converted HERE, in node, not in the page. A page that builds
 * its own body at load time has no `pre.mermaid` in it when the artifact host
 * looks for diagrams to render, so the diagrams never appear — and its first
 * still frame, which is what a thumbnail and a skimming reader get, says
 * "Rendering…".
 *
 * The page ships NO mermaid runtime. The artifact host has its own and renders
 * every `pre.mermaid` itself; a second runtime does not add a fallback, it
 * races for the same elements, and because mermaid scopes a diagram's fills to
 * the svg id it generated, the loser leaves those rules matching nothing and
 * every shape falls back to the SVG default fill, which is black.
 *
 * Usage:
 *   node bin/render-report.mjs <report.md> [--no-open]
 *
 * Arguments:
 *   <report.md>  Path to the markdown report. The HTML is written next to it as
 *                <report>.html.
 *   --no-open    Write the HTML but don't launch a browser (print the path only).
 *
 * Exit codes:
 *   0  HTML written (and opened unless --no-open)
 *   1  Bad arguments or the input file is missing
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {marked} from "marked";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {openPath} from "./utils.mjs";

const args = process.argv.slice(2);
const noOpen = args.includes("--no-open");
const mdPath = args.find((a) => !a.startsWith("--"));

if (!mdPath || !existsSync(mdPath)) {
  console.error("usage: render-report.mjs <report.md> [--no-open]");
  process.exit(1);
}

const htmlPath = mdPath.replace(/\.md$/, "") + ".html";

/* The house stylesheets, read from `styles/` at render time and inlined.
 *
 * Inlining a GENERATED copy is not the thing `draft-design-spec` forbids. That
 * rule is about authoring a second copy by hand, which drifts; here the single
 * file on disk stays the only source, so a restyle is still one edit. What it
 * buys is a report that is one self-contained page — nothing to publish
 * alongside it, and nothing to resolve at the far end.
 *
 * Tokens first: the chrome sheet reads every colour and face from them. */
const styleDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "styles");
const css = ["casomo-tokens.css", "casomo-spec.css"]
  .map((f) => readFileSync(resolve(styleDir, f), "utf8"))
  .join("\n");

// A mermaid classDiagram rejects union/bracket types in a member line
// (`date|None`, `list[Item]`) — soften them inside class bodies so an imperfect
// source (e.g. a design-xray map) still renders. Scoped to classDiagram fences
// only, so other diagrams (docs-xray flowcharts) are left untouched.
const softenClassDiagrams = (text) =>
  text.replace(/```mermaid\n([\s\S]*?)```/g, (block, body) =>
    /\bclassDiagram\b/.test(body)
      ? "```mermaid\n" +
        body.replace(/\{[^{}]*\}/g, (b) =>
          b.replace(/\|/g, " or ").replace(/[[\]]/g, ""),
        ) +
        "```"
      : block,
  );

const body = marked
  .parse(softenClassDiagrams(readFileSync(mdPath, "utf8")))
  // `marked` emits a fenced mermaid block as <pre><code class="language-mermaid">.
  // The artifact host looks for <pre class="mermaid">, so rewrite it at build
  // time rather than in the page — see the header note on why that matters.
  .replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, diagram) => `<pre class="mermaid">${diagram}</pre>`,
  );

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${mdPath}</title>
<style>
${css}
</style>
</head>
<body>
<div class="wrap" style="padding-top:32px">
${body}
</div>
</body>
</html>
`;

writeFileSync(htmlPath, html);
const url = `file://${resolve(htmlPath)}`;
console.log(url);

if (!noOpen) {
  openPath(url);
}
