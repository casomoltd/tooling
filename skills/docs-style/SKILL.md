---
name: docs-style
description: >-
  House convention for technical & reference docs — READMEs, CLAUDE.md,
  architecture notes, and the prose inside skills/agents. State current truth
  (not a changelog), link the owner instead of restating it, use links not
  backticks for cross-references, encode durable method not point-in-time data.
  NOT marketing/brand voice (a copy standard owns that) and NOT mechanical
  link/anchor validity (a markdown link linter owns that).
user-invocable: false
paths: "**/*.md"
---

# Documentation Style

## Intent

Govern house convention for technical and reference documentation — voice,
structure, sourcing, and cross-linking — so docs read as current, single-source
truth rather than drifting narrative.

## Applies-to

`**/*.md` (declared in `paths:`) — dev and reference docs (README, CLAUDE.md,
`docs/`, architecture notes) and the *prose inside* skill/agent definitions.
Preloaded as the rubric wherever markdown is written or reviewed (e.g. the
`docs-xray` agent). Marketing/brand copy is out of scope.

## Owns-vs-defers

Owns doc **convention** — voice, structure, single-source linking, sourcing, and
durability. **Defers**:

- skill/agent **section & frontmatter structure** to
  [`skill-agent-schema.md`](../../docs/skill-agent-schema.md) — that doc says
  *which* sections a unit needs; this rubric governs the prose *inside* them, not
  the skeleton.
- mechanical link/anchor validity and frontmatter schema to the markdown link
  linter (remark) — if a linter catches it, it isn't this rubric's to restate.
- prose voice for **marketing/brand copy** to the copy standard that owns brand
  voice — this rubric is for neutral technical/reference prose.
- cross-reference **coherence** (orphans, stale pointers, duplication graph) to
  the `docs-xray` agent — this rubric is what you author *against*; that agent
  judges the wired-up result.
- code **inside fenced blocks** to the language's own standard
  ([`python-style`](../python-style/SKILL.md),
  [`typescript`](../typescript/SKILL.md)).

## Voice

- **Second-person imperative, present tense.** Address the reader directly and
  state what *is* — "point to the owner", "the gate blocks release" — not a
  narrative ("we decided to…") or a future ("we should…").
- **Open with purpose before method.** Lead with what the doc is for and when to
  reach for it, so a reader can decide in seconds whether they need it and bail
  early if not.
- **Terse and scannable.** Prose only where a judgment needs explaining; let
  tables and lists carry parallel structure. Don't restate a whole other doc back
  — surface only what this one owns.
- **Bold marks the load-bearing words** — decision outcomes, key domain terms on
  first use, and hard constraints (never/always). A skim of the bold should
  convey the state.

## State current truth, not history

- A reference or policy doc states the **current fact**, not the path taken to
  it. No changelog narration — never "now uses X instead of Y", "the old Z is
  gone", or a stale staging banner ("lives here until the real home exists"). By
  the time someone reads it, the transition is context noise; state what is.
- The **one exception** is a doc whose whole job is the record: a dated audit
  trail or changelog explicitly logs what changed and why. If a doc isn't that,
  it reads as standing truth.
- **Don't enshrine a reconstructed or guessed value.** If you can't verify a real
  figure, ID, or path, ask for it — a plausible reconstruction committed as fact
  is worse than an obvious gap.
- **Verify an external source's recency *and* its content.** When you cite an
  outside reference, confirm both its last-updated date and that the *specific*
  thing you're citing actually changed — a page touch is not a content change.

## Single source of truth

- **One fact, one home.** Point to the owner (a link plus a one-line summary)
  rather than restating its content — "canonical interface, referenced not
  restated". Duplicated content drifts out of sync; a pointer can't.
- **Load heavy reference just-in-time.** Schemas, ID tables, and taxonomies live
  in their own linked file, not inlined into the main spine — the spine stays
  scannable and the reference updates independently.
- **Explain WHY, not WHAT.** A note earns its place by giving the rationale a
  reader can't infer from the thing itself; it never just restates the mechanic
  in prose.

## Cross-links & inline mechanics

- **Cross-document and file references are markdown links**
  (`[text](relative/path.md)`), not backticks — *when the target is reachable by a
  relative path in the same repo*. Links are linted and navigable; a backticked
  path is invisible to the link graph and rots silently. A reference to a file in
  *another* repo (not resolvable by a relative link) stays a backticked
  identifier — you're naming it, not pointing at it.
- Reserve backticks for inline **identifiers** — field names, IDs, code literals,
  commands, and unlinkable/cross-repo paths.
- **Prefer relative links** within a repo so the tree stays portable.
- **Fenced code carries a language tag** (` ```bash `, ` ```ts `, ` ```json `) —
  for highlighting and to signal the runtime a reader is looking at.
- **Tables for parallel structure.** A mapping, decision table, field schema, or
  option list reads better as a table than as prose: key in the left column,
  plain-text cells (no nested markup). Use prose for anything not genuinely
  parallel — a table of one real column is just a list.

## Durability

- **Encode durable method, never point-in-time data** — percentages, search
  volumes, live ranking positions, or a specific current redirect belong in a
  dated output, not a standing doc. Ask "will this still be true next quarter?";
  if not, it's data, and it goes elsewhere.
- **Name a doc or unit for the capability it provides**, verb-object
  (`triage-backlog`, not `backlog`) — a name is an action you invoke, not the
  noun it operates on.
- **88-column wrap** where prose allows. Don't hard-break a table row, URL, or
  link to hit it — those are the standard exceptions.
