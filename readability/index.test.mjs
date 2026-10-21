#!/usr/bin/env node
// Tests for the readability extractor: it reads what a reader sees on a
// page and nothing else. Each fixture is a small repo in a temp
// directory, so the import-following runs as it does on a real site.
import {strict as assert} from "node:assert";
import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";

import {extractText, scoreText} from "./index.mjs";

/** A site with `files` under its src/, returning the page's path. */
function site(files) {
  const root = mkdtempSync(join(tmpdir(), "readability-"));
  for (const [rel, body] of Object.entries(files)) {
    const file = join(root, "src", rel);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, body);
  }
  return join(root, "src", "app", "page.tsx");
}

// The page's own JSX text, with links folded into their sentence and a
// figure in place of each interpolation.
const page = site({
  "app/page.tsx": `import Link from "next/link";
import {Notice} from "@/components/notice";
import {rate} from "@/lib/rates";

export default function Page() {
  const items = new Map<string, number>();
  const big = rate > 2 && rate < 9;
  return (
    <main>
      <h1>Your pay</h1>
      <p>
        You pay {rate}% on the next pound, as the{' '}
        <Link href="/glossary">glossary</Link> explains.
      </p>
      <Notice />
    </main>
  );
}
`,
  "components/notice.tsx": `export function Notice() {
  return <p>Rates change every April.</p>;
}
`,
  "lib/rates.ts": `// A comment a reader never sees.
export const rate = 20;
const note = "This sentence is data, not something on the page.";
const check = (a: number, b: number) => a > b && b < 3;
`,
});
const text = extractText(page);
assert.match(text, /Your pay\./);
assert.match(text, /You pay 1 % on the next pound, as the glossary explains\./);
// A component's prose is on the page, so it is read.
assert.match(text, /Rates change every April\./);
// Code is not prose: generics, comparisons and a .ts module's strings
// and comments never reach the score.
assert.doesNotMatch(text, /Map|rate >|items|comment|data, not/);

// Strings joined with + read as the one sentence they are.
const joined = site({
  "app/page.tsx": `export const faq = {
  answer:
    'They are the current published scales. The four nations set'
    + ' pay separately, so the round can differ between them.',
};
export default function Page() {
  return <p className="flex items-center gap-2">Short.</p>;
}
`,
});
const joinedText = extractText(joined);
assert.match(joinedText,
  /The four nations set pay separately, so the round can differ/);
assert.doesNotMatch(joinedText, /items-center/);

// Inline edge cases: a line break is a space, conditional text keeps its
// first branch in the sentence, entities read as their characters, and a
// component's prose prop is copy on the page.
const edges = site({
  "app/page.tsx": `export default function Page({on}: {on: boolean}) {
  return (
    <>
      <p>Line one here<br />line two follows.</p>
      <p>Hello {on ? <strong>bold words</strong> : "plain words"} friend.</p>
      <p>Tom &amp; Jerry&nbsp;don&rsquo;t run.</p>
      <Card description="Your pension grows with every year you work." />
    </>
  );
}
`,
});
const edgeText = extractText(edges);
assert.match(edgeText, /Line one here line two follows\./);
assert.match(edgeText, /Hello bold words friend\./);
assert.match(edgeText, /Tom & Jerry don’t run\./);
assert.match(edgeText, /Your pension grows with every year you work\./);

// Scoring stays wired to the extracted text.
assert.equal(scoreText(text, {}).wordCount, text.split(/\s+/).length);

console.log("readability tests OK");
