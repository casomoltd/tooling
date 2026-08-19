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
   - **Author every diagram to FIT the page width — and measure it, don't eyeball
     it.** The skeleton's content box is 1080px wide with 24px padding, and the
     `.mermaid` card adds 20px padding plus a border, leaving **~990px** of usable
     width. A diagram wider than that spills into a horizontal scrollbar, which
     reads as broken however legible the text is. Measure by rendering headless
     and reading each SVG's `viewBox` width (`chrome --headless --dump-dom
     --virtual-time-budget=15000 file://…`, then extract `viewBox="0 0 W H"`);
     compare every figure to the budget in one pass. Levers, in the order they
     actually pay off:
     1. **`TD` over `LR`.** Far the biggest win — a left-to-right chain of two
        3-node groups measured 1733px; the identical graph as `TD` measured
        **206px**. Vertical is also usually the better metaphor (a ledger is
        stacked rows, a pipeline is stages).
     2. **Short node labels**, with the detail in the `.legend` beneath.
     3. **Never repeat in a node what an adjacent table already states** — e.g.
        per-node fan-in counts when a fan-in table sits directly above. That is
        the one-representation-per-fact rule, and it buys width for free.
     4. **Collapse siblings that share a role into one node** — three consumers
        of the same boundary, or two sibling data files, can be one box whose
        members list them.
     5. **Short subgraph titles** — a long title sets that subgraph's *minimum*
        width, so a sentence-length title silently widens the whole figure. Put
        the sentence in the legend.
     6. **Short edge labels.**
     Past a point, width is set by **how many nodes sit in the widest rank**, not
     by label length — when trimming text stops helping, remove or merge nodes,
     or split the figure in two. **Check `subgraph` wrappers before you trim
     anything**: cluster padding, plus the way a cluster pins its members
     together against the layout, costs far more width than long text. Removing
     two of them took one figure from 1225px to 945px after label-trimming had
     stalled — and the grouping they carried was better served by node shape
     plus a line in the legend.
   - **Keep every mermaid diagram legible, never shrunk-to-fit** — the skeleton
     sets `useMaxWidth: false` so a wide graph renders at full size and scrolls
     inside its `overflow-x` box rather than being squeezed to container width
     (which shrinks the text to unreadable). Author diagrams to match: short node
     labels (push descriptions to the `.legend` beneath, not into the node),
     prefer a top-down (`TD`) layout, and keep each rank to a handful of nodes. A
     diagram the reader scrolls is fine; one they must zoom into is a defect —
     split it or trim the labels.
   - **Mermaid `classDiagram` — traps that only surface on render.** Colour nodes
     with **per-node `style X fill:#…,stroke:#…`** — `classDef`/`cssClass` *parse
     but don't paint* in a classDiagram (every box comes out grey, so a colour
     `.legend` lies), and `classDef` throws outright on a multi-property style
     (single property only) or on `namespace`. Show library/group boundaries with
     those per-node colours + a `.legend` key, **not `namespace` boxes**. Give
     **every node ≥1 edge** — a floating orphan distracts the reader — and keep
     ids unique **case-insensitively** (`Foo`/`foo` collide into one node). None
     of this shows until the page renders (a broken diagram is a red error box, a
     grey or orphaned one a silent defect), so **glance at each diagram on open
     and confirm it is coloured and connected**. **Escape guillemet annotations
     as `&lt;&lt;name&gt;&gt;`** — a bare `<<my-unit>>` inside `<pre>` is eaten
     by the *browser*, not mermaid: any hyphenated tag is a valid custom-element
     name, so `<my-unit>` is parsed as an element and the diagram dies with a
     syntax error. Best caught by actually rendering the file: a headless
     `chrome --headless --dump-dom --virtual-time-budget=15000 file://…` and a
     grep for `Syntax error in text` checks every figure in one shot, and also
     catches the silent defects (an uncoloured or orphaned node) that a glance
     misses.
   - **Every figure carries a two-part caption — no exceptions.** A diagram with
     no legend, or a legend whose chips don't match the colours actually in the
     picture, is the single most reliable way to lose a review round. Each
     `<pre class="mermaid">` is immediately followed by a `.legend` giving
     (a) **scope** — which package/repo/layer *every* node lives in, naming any
     node that is outside it and what this spec does or doesn't change there —
     and (b) **colour**, as swatches that are the same hex the diagram paints.
     If a figure has no foreign node, say so and say why; "no boundary is drawn
     here" is information, silence isn't.
   - **A legend is a key, not an inventory — and caption bloat has exactly
     three causes.** A legend maps symbol to meaning and then stops. It must
     never list *which* nodes carry a symbol — "purple: the ledger, its years,
     segments, the converter…" — because the reader can see that by looking at
     the picture. When a caption grows past a few lines it is carrying
     something that belongs elsewhere, and it is always one of three things:
     an **enumeration** (delete it, the figure already shows it), **per-item
     detail** (move it to the reference table below), or **argument** (move it
     to prose *above* the figure, where it reads better anyway). Applying this
     to one real spec took its largest caption from ~3,300 characters to under
     1,000 without losing a sentence worth keeping.
   - **One colour key for the whole document.** Fill the skeleton's
     `#diagram-key` card once and have every legend link back to it. Colour
     means **change status** (new / reshaped / unchanged / removed / another
     unit) in every figure; where a second axis is needed, carry it on **shape**,
     not on a second colour meaning. A reader holds one key, not four. A purely
     *logical* figure (an execution or calculation flow) is exempt — but it must
     say so in its legend and explain any highlight it does use.
   - **A process or flow diagram is complete when a reader can answer all seven
     of these from the picture alone.** The failure mode is a tidy spine of
     verbs that quietly omits everything around it — and it survives review
     because it *looks* finished. Walk the list:
     1. **What enters** — every argument as its own node, **entering at the
        step that consumes it**, never collected into one "inputs" box at the
        top. Drawn this way it makes a real property checkable at a glance:
        whether any input is threaded through the pipeline and re-consulted.
     2. **What the system itself owns** — its reference tables, cited data,
        constants. A diagram showing only caller inputs implies the thing
        computes out of thin air, and that omission is easy to miss.
     3. **Where iteration sets come from.** "For each X" is incomplete without
        the step that enumerates X and the bound that ends it.
     4. **What each operation IS.** A box named `revaluation` hides that it is
        one number plus a conditional adjustment. Decompose it, or hang a
        non-step annotation node off it saying what it is made of.
     5. **The failure path** — what throws, and where. Happy-path-only diagrams
        hide the most opinionated decisions in the design.
     6. **What comes out**, in the caller's terms.
     7. **What is a VIEW rather than part of the calculation** — drawn off to
        one side, so derived extras are never mistaken for pipeline stages.
   - **One box, one operation — and be honest about the branching.** A node
     captioned "label each year with its rule" is three decisions in a trench
     coat; expand until no box hides a choice. Then state where branching
     actually lives. "Every decision is in an up-front derivation and the loop
     below is uniform" is both stronger and more checkable than "there are no
     branches" — and unlike the latter, it survives someone reading the boxes.
   - **Steps and annotations must look different.** A node saying *what a thing
     is* is not a step in the process. Give it a distinct shape and a dashed
     border, and say so in the legend, or readers will count it as a stage.
   - **Make every class in a diagram click through to its definition.** A
     reader looking at a box wants the fields, and scrolling to find them
     breaks the thread. Mermaid supports `click ClassName href "#anchor"`
     (the skeleton already sets `securityLevel: 'loose'`, which it needs), so
     give each type an anchored heading above its code block —
     `<h5 id="t-Name" style="scroll-margin-top:68px">` — and emit one `click`
     line per class. The `scroll-margin-top` matters: without it the sticky
     TOC covers whatever you jump to. Two payoffs beyond navigation: it splits
     a wall of types into one block per type, and it lets the **boxes stay
     terse**, because the explanation now lives one click away instead of
     being crammed into node labels.
   - **Use real UML member syntax, and state the notation in the legend.**
     Bare words in a class box are an undifferentiated blob — a reader cannot
     tell a field from a method. Write `+field Type` and `+method() Return`
     (mermaid keys on the parentheses and draws the compartment divider
     itself), and add `<<enum>>` / `<<union>>` / `<<function>>` stereotypes
     where the thing is not an ordinary class. Then say in the legend which
     end each relationship symbol attaches to: a filled diamond marks the
     *whole* in a composition, a plain arrow is an association to something
     shared, and a dashed dependency points **from** the dependent **to** what
     it depends on. Reviewers do ask "is this arrow the right way round?", and
     the answer belongs on the page. Typed members are usually *narrower* than
     prose ones, so this tends to buy width rather than cost it.
   - **Pair a class diagram with a reference table — the diagram cannot say
     WHY.** A box shows a name and its fields and has no room for the reason
     the thing exists, which is the question a reviewer actually asks first.
     Put a table under the figure, one row per box: **name** (linked to its
     definition), **kind**, **status**, and **responsibility — and why it needs
     to exist**. It pays three times over: the reason is recorded where someone
     looks for it, per-item detail leaves the caption, and the boxes can stay
     terse because the prose now has a better home. Keep table and figure in
     exact correspondence — a row per box, no more and no fewer — since drift
     between them is the same staleness trap as drift between two diagrams.
   - **Name the kind; "class" is usually wrong.** A diagram of boxes in a
     TypeScript or Python codebase is rarely all classes — it is interfaces,
     discriminated unions, string-literal unions, function types, protocols,
     dataclasses, enums. Read each kind off its definition rather than
     assuming, put it in the reference table, and give the node a matching
     stereotype (`<<discriminated union>>`, `<<function type>>`), worded
     identically in both. This is not pedantry: the union is often exactly
     where a design's provenance or variance lives, and the function type is
     often what keeps a loop branchless — so mislabelling them hides the two
     most interesting things in the model.
   - **Audit relationships across diagrams, not just within one.** Two figures
     describing the same model will drift: the same pair rendered `A *-- B` in
     one and `A --> B : has` in the other, or a dependency drawn in opposite
     directions in each. Both happened in a real spec. Before publishing, list
     every edge in every figure and reconcile them — divergence is a signal
     that one of them is stale, not a formatting nit.
   - **Keep decision history OUT of the body — collect it in one section.** A
     spec that survives a few review rounds accumulates archaeology: "an earlier
     draft said X, which was wrong, it is gone." Each sentence was worth writing
     the moment it was written and is dead weight afterwards — it makes the body
     narrate its own history instead of stating what the design *is*, and a
     reader hunting the current answer has to parse which paragraph is live. Two
     rules: **the body is written in the present tense about the current
     design**, and any position reached by *reversing* an earlier one goes in a
     single **Decision history** section near the end (was / is / why, newest
     first). That section earns its place — it stops a reviewer re-proposing the
     rejected option — but it only works if it is the *only* place. When a
     review reverses something, move the story there and rewrite the body clean;
     do not leave a trail. Distinguish this from **rationale**, which stays: "two
     ledgers would need concatenating, so there is one" is timeless design
     reasoning; "an earlier draft had two ledgers" is archaeology.
   - **Number every open question, and scope it.** Rows are `Q1, Q2, …` across
     the whole table, open and settled alike, so a number never changes meaning.
     Each carries a **scope** cell saying whether this spec is entitled to
     answer it at all — see the Guardrail below.
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
- **Never answer a question a different consumer would be entitled to answer
  differently.** Product and presentation calls — what a headline figure quotes,
  whether a table is drawn, whether a control is an age or a date — arrive mixed
  in with design ones, and a spec that quietly settles them turns them into
  policy inside a unit that several consumers share. Split each such question:
  keep the half that says what must be **computed or carried** so the choice is
  *possible* (provenance on a record, both units of measure, a discriminant),
  and route the rest, marked, to the layer that owns it. Then **say whether the
  routing comes with a code change**: an API-delta table stating, per exported
  symbol, whether a caller breaks. Handing a consumer a decision without telling
  it whether it must also change code is the half-finished version of this.
- **Never claim a property without saying what enforces it and where it
  stops.** "The rows are immutable"; "the caller already has this data". A
  spec's comfortable-sounding words become load-bearing fast, and a reader
  will build on them. State the *mechanism* — compile-time, runtime, or merely
  a convention — and state the *gap*: what it does not cover, measured rather
  than assumed. A claim with a stated limit can be trusted; one without invites
  someone to find the limit in production.
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
