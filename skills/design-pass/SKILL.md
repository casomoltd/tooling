---
name: design-pass
description: >-
  Run a design pass over a package or diff: map its structure, review the
  highest-impact targets against the house standards, then refactor — chaining
  the design-xray agent → the code-review agent → an approved refactor. Reach
  for it BEFORE designing an extension or refactor — adding a variant, a second
  implementation, or reshaping a package — so the structural map drives the
  design rather than a least-disruption bolt-on; also use to see and improve the
  shape of existing code. Produces a doc-ready structural map as a side effect.
  Read-only until you approve the refactor. NOT a bug hunt (that's /code-review)
  and NOT a linter (eslint/ruff).
user-invocable: true
argument-hint: "<path|diff> [-C <repo>]"
allowed-tools:
  - Bash(ruff *)
  - Bash(uv run *)
  - Bash(npm run check)
  - Bash(git *)
  - Bash(cd *)
  - Bash(node *)
  - Read
  - Write
  - Glob
  - Grep
---

# Design Pass

## Intent

Map → review → refactor a package or diff: chain `design-xray` (structure) →
`code-review` (judgment) → an approved refactor. One job: let the structural map
drive the change instead of a least-disruption bolt-on.

Map → review → refactor, in that order. Each stage feeds the next. Follow the
steps in order; do NOT skip or reorder. The pass makes **no change to the user's
codebase until step 5** — the only earlier write is a disposable preview artifact
(step 2) outside the repo, in the system temp dir.

Run this **before** committing to a design when extending a package, not after.
Starting from the structural map is the point: it routinely shows the "new" thing
is a variant of something that already exists — N near-identical units where a
type belongs — so the right move is to abstract, not to bolt on an (N+1)th copy.
A plan that starts from "how do I add my thing with least disruption" walks past
that; the map doesn't.

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
2. Render + open it with the shared harness — **do not re-author the HTML**:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/render-report.mjs" <repo>/scratch/design-xray/<target-slug>.md
   ```
   `render-report.mjs` wraps the `.md` in a self-contained HTML file next to it
   (marked + mermaid from CDN), **softens classDiagram member lines** so an
   imperfect x-ray still renders (union/bracket types like `date|None` /
   `list[Item]`), prints the `file://` URL, and opens it in the browser. It is the
   single source of the render recipe — shared with `docs-xray`, so the harness
   lives in exactly one place. Needs network for the two CDN scripts; if the
   opener mis-routes `text/html`, the printed `file://` URL still works, or run
   `xdg-mime default firefox_firefox.desktop text/html`.

Do NOT chase in-editor mermaid (e.g. a VSCode extension) as the path — the
self-contained HTML from `render-report.mjs` is the reliable renderer. THEN, and only on explicit
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

When a finding is stale documentation or a drifted citation, fix it in the same
pass — but a citation moves with the code or data it documents, and an **external
figure is verified against its original source before you touch it**: never
commit a reconstructed or guessed value (defer to `docs-style`'s recency-and-
content rule). If you cannot confirm the source, surface the gap rather than
enshrining a plausible reconstruction.

## 6. Review the generated diff and iterate

The refactor just *wrote* code — review THAT, not only the pre-refactor targets
from step 3 (step 3 decides what to change; this checks how the change landed).
Invoke the `casomoltd:code-review` agent over the changed files (the diff), so
the design-half judgment (value objects, EAFP-not-sentinels, DI, no hardcoded
config, factory classmethods, protocols/interfaces placed well) runs over what
was actually generated. Apply the high-confidence findings, re-run the checks,
and repeat — a **bounded loop (2–3 rounds)** until the diff comes back clean or
only genuine judgment calls remain, which you surface to the user rather than
churn on. This is the generate → review → iterate loop; skipping it ships
unreviewed codegen (the failure mode this step exists to close).

## 7. Verify and summarise

Re-run the repo's checks over what changed and report the result honestly:
- Python → `ruff check` (and `pyright`/`uv run pytest` if the repo uses them).
- TypeScript → `npm run check`.

Then summarise: what was refactored, what was deferred (and why), and the
doc-ready block for the user to keep. If checks fail, say so with the output —
don't paper over it.

## Boundaries

- **vs the built-in `/code-review`** — that hunts correctness bugs; this pass does
  design/structure only. It *invokes* `casomoltd:code-review` for house-standard
  judgment but never duplicates the bug hunt.
- **vs `eslint` / `ruff`** — the linters own mechanical rules; this pass owns the
  design half (shape, separation of concerns, pattern-warranted-or-premature).
- **vs its worker agents** — `design-xray` and `code-review` hold the judgment;
  this skill only orchestrates and applies the approved diff.
