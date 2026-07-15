#!/usr/bin/env node

/**
 * Render a markdown + mermaid report to a self-contained HTML file and open it
 * in the browser — the reliable renderer for agent reports (docs-xray,
 * design-xray) whose mermaid diagrams render unreliably in editor previews.
 *
 * The report `.md` is inlined into an HTML harness that loads `marked` and
 * `mermaid` from CDN, so the output is one portable file — no build step, no
 * editor extension. Write reports into a repo-local dir (e.g. `scratch/`), not
 * `/tmp`: sandboxed browsers (snap/flatpak) often can't read outside $HOME.
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
import {resolve} from "node:path";
import {openPath} from "./utils.mjs";

const args = process.argv.slice(2);
const noOpen = args.includes("--no-open");
const mdPath = args.find((a) => !a.startsWith("--"));

if (!mdPath || !existsSync(mdPath)) {
  console.error("usage: render-report.mjs <report.md> [--no-open]");
  process.exit(1);
}

const htmlPath = mdPath.replace(/\.md$/, "") + ".html";

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

// Inline the markdown in a <script type="text/markdown"> so its backticks and
// fences aren't parsed as HTML. The only hazard is a literal </script> in the
// source, which we defuse.
const md = softenClassDiagrams(readFileSync(mdPath, "utf8")).replaceAll(
  "</script>",
  "<\\/script>",
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${mdPath}</title>
<style>
  body { max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;
         font: 15px/1.6 system-ui, sans-serif; color: #1a1a1a; }
  h1, h2, h3 { line-height: 1.25; }
  h2 { border-bottom: 1px solid #eee; padding-bottom: .3rem; margin-top: 2.5rem; }
  table { border-collapse: collapse; margin: 1rem 0; font-size: 14px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f7f7f7; }
  code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: .9em; }
  pre { background: #f7f7f7; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  pre.mermaid { background: #fff; }
  a { color: #0b66c3; }
</style>
</head>
<body>
<div id="content">Rendering…</div>
<script id="md" type="text/markdown">
${md}
</script>
<script type="module">
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral" });
const el = document.getElementById("content");
el.innerHTML = marked.parse(document.getElementById("md").textContent);
// marked emits mermaid fences as <code class="language-mermaid">; mermaid wants
// <pre class="mermaid">.
el.querySelectorAll("code.language-mermaid").forEach((c) => {
  const pre = document.createElement("pre");
  pre.className = "mermaid";
  pre.textContent = c.textContent;
  c.closest("pre").replaceWith(pre);
});
await mermaid.run({ querySelector: ".mermaid" });
</script>
</body>
</html>
`;

writeFileSync(htmlPath, html);
const url = `file://${resolve(htmlPath)}`;
console.log(url);

if (!noOpen) {
  openPath(url);
}
