---
name: draft-design-spec
description: >-
  Turn a task or brief into a browser-reviewable, self-contained HTML design
  spec authored into scratch — the pre-implementation planning artefact — then
  iterate on the same file instead of a terminal wall-of-text plan. Reach for it
  proactively, without being asked, whenever a task is SPEC-SIZED: a large
  redesign, a new feature or subsystem, a domain-model remodel, a package
  extension, or the target shape of a multi-file refactor that should be reviewed
  before any code is written. In planning mode it resolves the brief, grounds in
  the current state via the design-xray agent, and authors a 13-section spec
  (thesis, data reality, current + target class models with mermaid, full type
  definitions, rationale, migration, phasing, open questions) the user reviews in
  a browser. Writes NO product code. NOT for a small edit, a single-function
  change, a bug fix, or a quick question — those don't need a spec. NOT for
  reshaping code that already exists into an applied diff (that's design-pass) ·
  NOT for multi-source web research (that's deep-research) · NOT for logging the
  work as a tracked ticket (that's create-task). After approval, hand off to
  implementation (optionally via design-pass).
user-invocable: true
argument-hint: "<brief | file | task-url> [-C <repo>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(git *)
  - Bash(mkdir *)
  - Bash(cp *)
  - Bash(xdg-open *)
  - Bash(open *)
  - mcp__claude_ai_Notion__notion-fetch
---

# Draft Design Spec

## Intent

Author a **browser-reviewable HTML design spec** from a brief and iterate on it —
the pre-implementation planning artefact, writing **no product code**. One job:
replace a terminal wall-of-text plan with a persistent, self-contained HTML file
(class models, full type definitions, per-decision rationale) that the user reads
and refines in a browser.

This is a **planning-mode** step. The output is a single `scratch/<slug>.html`
file, not a terminal plan and not the harness plan file. The pass stays
**authoring-into-scratch only** — it makes no change to product code at any
point; implementation is a separate, explicitly-approved step (see Boundaries).

## Scope

**In:** design thinking that should be *reviewed before* it is built — a new
feature, a domain-model remodel, a package extension, a refactor's target shape.
**Out:** writing product code, running web research, opening tickets. Seams to
each sibling are in Boundaries.

Grounding the current-state map is **Python / TypeScript** (`.py` / `.ts` /
`.tsx`) — the languages `design-xray` judges. A greenfield or other-language
brief still gets a spec; it just leans on the brief rather than an x-ray map.

## 0. Resolve the source (fail loud)

Accept one of: an **inline prose brief**, a **file path**, or a **task-tracker
ref / URL**. Resolve the target repo from `-C <path>` (git-style) or the current
directory.

- A **Notion task URL/ID** and the `notion-fetch` tool available → fetch it and
  map the body onto the spec's seed: `## Context` → problem/motivation,
  `## Definition of done` → acceptance criteria + scope, `## Notes` →
  constraints. (Generic fetch — the user supplies the URL/ID; hardcode no
  database identifiers.)
- **Inline / file** → read it directly into the same problem / criteria /
  constraints shape.

If the source is empty or the deliverable is genuinely ambiguous, **stop and
ask** — do not guess a spec into existence.

## 1. Shape the brief

Nail down only the **expensive-to-undo forks** with **at most 2–3** clarifying
questions (e.g. which package/boundary the spec targets; refactor-of-existing vs
net-new; the success criterion if the task didn't state one). For everything
else, pick a **recommended default, record the choice**, and park residual
unknowns for the spec's **Open questions** section. Bias to a full reviewable
draft over interrogation — reserve questions for decisions that are costly to
reverse.

## 2. Ground in the current state

Invoke the `casomoltd:design-xray` agent on the target package/module. Use its
**§1 class-hierarchy `classDiagram`** as the spec's "before" map (§5) and **cite
its pattern verdict** in the rationale (§8) — warranted-now vs premature is a
decision the spec should record, not re-litigate.

Skip only if the work is **genuinely greenfield** — then §5 states "greenfield —
no prior model" and names the adjacent code the work will touch instead. Never
emit an empty or fabricated diagram.

## 3. Author the spec

1. Ensure `<repo>/scratch/` exists and is gitignored — create the dir and add
   `scratch/` to `.gitignore` if absent (fail loud if you can't). A consuming
   workspace's own `CLAUDE.md` may designate a different out-dir; honour it.
   Write into the repo, **never `/tmp`** (sandboxed browsers can't read it).
2. Copy the skeleton — do **not** re-author its `<head>` or `<style>`:
   ```bash
   cp "${CLAUDE_PLUGIN_ROOT}/skills/draft-design-spec/skeleton.html" <repo>/scratch/<slug>.html
   ```
   (If `CLAUDE_PLUGIN_ROOT` is unset — running from source — use the repo-relative
   `skills/draft-design-spec/skeleton.html`.)
3. Fill the body sections (the nine numbered sections **plus the dependency-graph
   appendix**) via `Edit`, following the skeleton's inline guidance comments (they
   carry the per-section spine). Load-bearing craft:
   - **Draw both dependency graphs by default** (the appendix) — a *component*
     dependency graph and a *type* dependency graph. Draw a **dependency** view
     (who imports/refers to whom), **not a containment tree**: reuse must be
     visible as a node with many in-edges. Ground them in the `design-xray` map
     plus a quick import-edge scan (grep the imports); fill the fan-in reuse
     table, mark the units in the change's scope, and keep the skeleton's fixed
     colour/shape key. This is the map the user judges reuse from — never skip it.
   - **Keep every mermaid diagram legible, never shrunk-to-fit** — the skeleton
     sets `useMaxWidth: false` so a wide graph renders at full size and scrolls
     inside its `overflow-x` box rather than being squeezed to container width
     (which shrinks the text to unreadable). Author diagrams to match: short node
     labels (push descriptions to the `.legend` beneath, not into the node),
     prefer a top-down (`TD`) layout, and keep each rank to a handful of nodes. A
     diagram the reader scrolls is fine; one they must zoom into is a defect —
     split it or trim the labels.
   - **Lead with the type/interface definitions over duplication** — extract a
     shared generic core validated by **≥2 real callers** rather than bolting on
     an (N+1)th variant.
   - **Python targets carry an ABC-weighted class hierarchy** — name which
     `collections.abc` each domain collection is (`Mapping` / `Set` / `Sequence`
     / `Collection`), chosen by the **access pattern actually used**, not storage.
   - **Apply the house design rubric** ([`../../docs/design-rubric.md`](../../docs/design-rubric.md))
     — run its **review lens up front** (does the library already give me this?
     one producer per value? the smallest thing across the boundary? a concern per
     layer — computation in the domain, presentation in the rendering layer, config
     in the shared store, identity in the library?), so the spec is *authored to*
     the standards, not corrected into them over review rounds. The rubric's
     rule-level specifics live in the language standard (`typescript` /
     `python-style`).
   - Keep `<nav.toc>` labels in sync with the `<h2>`s; delete guidance comments
     as you fill; every section either says something real or says why it's N/A.

## 4. Open and hand over

`xdg-open` the file and print the `file://` path. Surface the **key decisions**
in chat, but let the user read the artefact itself — do not only text-summarize
(the map, type defs, and open questions don't survive a summary).

## 5. Iterate in place

On feedback, `Edit` the **same file**; the user refreshes. Stay
authoring-into-scratch (no product-code writes) until the design is approved.

## 6. Approval → hand-off

On approval, the next step is explicit and **outside this skill**: implement the
approved design (optionally via `casomoltd:design-pass` when it reshapes existing
code), and/or log follow-ups with `create-task`. State the boundary — do not
cross into implementation.

## Guardrails

- **Never write product code.** The only writes are the scratch `.html` and a
  `scratch/` gitignore line — no `.ts`/`.py`/config/source edits, in any phase.
- **Never write outside repo-local `scratch/`** (or the out-dir a consuming
  `CLAUDE.md` designates) — never `/tmp`, never a product source tree.
- **Never bake private context** into the spec or this skill — no private repo
  names, tracker database IDs, or absolute workspace paths; stay source-agnostic.
- **Never re-author the frozen `<head>`/`<style>`** — copy the skeleton; the
  fixed design system is the point. Fill body sections only.
- **Never invent figures or citations** — every data cell traces to a source;
  unknowns go to Open questions, not a fabricated value.
- **Never proceed past a genuinely ambiguous brief** — fail loud and ask.
- **Never cross into implementation on approval** — hand off.

## Boundaries

- **vs `casomoltd:design-pass`** — design-pass reshapes code that **already
  exists** and ends in an **applied, reviewed diff** (it writes product code).
  This skill is **upstream of any code**: a reviewable artefact for work not yet
  built, writing none. They compose — an approved spec becomes design-pass's
  brief when the build is a refactor. Both invoke `design-xray` for the
  current-state map; that's shared tooling, not overlap.
- **vs `deep-research`** — that fans out **web** searches for an external
  question; this grounds in the **local codebase** and returns an engineering
  design spec. External facts the brief needs are a deep-research pre-step.
- **vs `create-task`** — that authors **one tracked ticket**; this **consumes** a
  task as a source and never writes the tracker. Post-approval follow-ups route
  to create-task.
- **vs the built-in plan mode** — plan mode yields an **ephemeral terminal**
  plan; this yields a **persistent, browser-rendered, iterable** artefact with
  diagrams and typed definitions. Run it *from within* planning mode as the
  artefact-producing upgrade of "make a plan".
