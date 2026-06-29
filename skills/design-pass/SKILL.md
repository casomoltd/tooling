---
name: design-pass
description: >-
  Run a design pass over a package or diff: map its structure, review the
  highest-impact targets against the house standards, then refactor — chaining
  the design-xray agent → the code-review agent → an approved refactor. Use to
  see and improve the shape of code before or during a change. Produces a
  doc-ready structural map as a side effect. Read-only until you approve the
  refactor. NOT a bug hunt (that's /code-review) and NOT a linter (eslint/ruff).
user-invocable: true
argument-hint: "<path|diff> [-C <repo>]"
allowed-tools:
  - Bash(ruff *)
  - Bash(uv run *)
  - Bash(npm run check)
  - Bash(git *)
  - Bash(cd *)
  - Bash(xdg-open *)
  - Bash(open *)
  - Read
  - Write
  - Glob
  - Grep
---

# Design Pass

Map → review → refactor, in that order. Each stage feeds the next. Follow the
steps in order; do NOT skip or reorder. The pass makes **no change to the user's
codebase until step 5** — the only earlier write is a disposable preview artifact
(step 2) outside the repo, in the system temp dir.

This skill **orchestrates**; it does not re-implement. The judgment lives in two
worker agents it invokes:
- `casomoltd:design-xray` — the structural map + design findings + handoff.
- `casomoltd:code-review` — house-standard judgment on specific files.

Scope is **Python and TypeScript** (`.py` / `.ts` / `.tsx`); other languages
have no house rubric, so the review/refactor stages skip them.

## 0. Resolve the target

- `-C <path>` given → that repo (resolved git-style from the current dir).
- otherwise → the current directory.

Then resolve **what to analyse**:
- a path/package → that subtree.
- `diff` / `HEAD` / a commit → the changed `.py`/`.ts`/`.tsx` files.

If the target is ambiguous or empty, stop and ask — don't guess (fail loud).

## 1. Map (read-only)

Invoke the `casomoltd:design-xray` agent on the target. Capture all five
sections it returns: the doc-ready map (inventory + mermaid), the weight table,
the design findings, the **handoff refactor-targets** table, and the pattern
verdict. The handoff table is the contract that drives the rest of this pass.

## 2. Render the FULL report + offer docs

The agent's report comes back to the orchestrator as text — the user only sees a
"finished" notification, not the report, and markdown/mermaid don't render in a
terminal. So **always persist the whole report and open it** — not just the
diagram, not just a summary.

Write into the **target repo**, never `/tmp`: sandboxed browsers (snap/flatpak
Firefox) cannot read `/tmp`, but can read files under the user's home. Use a
gitignored scratch subdir at the repo root: **`<repo>/scratch/design-xray/`**.
If `scratch/` is not already gitignored in the target repo, create the dir and
add `scratch/` to its `.gitignore` first (fail loud if you can't).

1. Write the agent's **entire returned markdown** verbatim to
   `<repo>/scratch/design-xray/<target-slug>.md` (mermaid stays a normal fenced
   ```mermaid block with literal `<<abstract>>` stereotypes).
2. Wrap that `.md` in a self-contained HTML harness written next to it
   (`…/<target-slug>.html`) that renders markdown + mermaid:
   - load `marked` (`https://cdn.jsdelivr.net/npm/marked/marked.min.js`) and
     `mermaid` (`https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs`);
   - embed the markdown in a `<script type="text/markdown">` block (so `<`/`>`
     aren't parsed as HTML), `marked.parse` it into a `<div>`, convert each
     `code.language-mermaid` into `<pre class="mermaid">`, then
     `mermaid.run({ querySelector: ".mermaid" })` with `startOnLoad: false`.
   Build it by concatenating header + the `.md` + footer (don't hand-duplicate
   the report). This needs network for the two CDN scripts.
3. Print both **`file://` URLs** (clickable) and open the HTML with the platform
   opener (`xdg-open` on Linux, `open` on macOS). `text/html` must be associated
   with a browser, not a mail client — if `xdg-open` mis-routes, the user can run
   `xdg-mime default firefox_firefox.desktop text/html`.

Do NOT chase in-editor mermaid (e.g. a VSCode extension) as the path — the
self-contained HTML is the reliable renderer. THEN, and only on explicit
confirmation, **offer** to persist the doc-ready block into a real
`README`/`ARCHITECTURE` doc in the repo — writing only that block, nothing else.

## 3. Review the targets (read-only)

Route the handoff targets into the `casomoltd:code-review` agent — focused on
exactly those files/symbols, with the "what to scrutinise" note as the brief.
- A handful of targets → one `casomoltd:code-review` invocation over them.
- A large target set → fan out one review per target so each gets full
  attention. For a substantial fan-out, you MAY use the Workflow tool to run
  the per-target reviews in parallel (this is the only place orchestration
  parallelism is warranted; the rest of this skill is sequential).

Merge the code-review findings with the x-ray design findings, de-duplicated and
ranked by impact. This merged list is the refactor plan.

## 4. Confirm the refactor plan

Present the merged, ranked plan and ask the user which items to apply. Call out
anything the x-ray flagged as **speculative infrastructure** (don't add it) and
anything its verdict deemed a **premature pattern** (don't introduce it). Do not
proceed to step 5 without explicit approval.

## 5. Refactor (the only writing stage)

Apply only the approved items. Before editing `.py`, load the `python-style`
rules; before editing `.ts/.tsx`, load the `typescript` rules — so the refactor
lands in house style rather than getting re-reviewed into it. Keep edits tight
and reviewable; prefer the smallest change that resolves the finding.

## 6. Verify and summarise

Re-run the repo's checks over what changed and report the result honestly:
- Python → `ruff check` (and `pyright`/`uv run pytest` if the repo uses them).
- TypeScript → `npm run check`.

Then summarise: what was refactored, what was deferred (and why), and the
doc-ready block for the user to keep. If checks fail, say so with the output —
don't paper over it.
