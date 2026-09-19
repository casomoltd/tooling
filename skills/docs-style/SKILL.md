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
Preloaded as the rubric wherever markdown is written or reviewed:
[`doc-review`](../../agents/doc-review.md) applies it to one doc,
[`skill-review`](../../agents/skill-review.md) to a skill or agent brief, and
[`docs-xray`](../../agents/docs-xray.md) to the corpus graph. Marketing/brand
copy is out of scope.

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
- **Contract where a person speaking would** — "that's why", "what's missing",
  "it isn't built yet", not "that is why". A doc is one engineer explaining
  something to another, and the long form reads as a register the writer has
  put on. The exception is quoted material, where contracting would misquote.

## State current truth, not history

- A reference or policy doc states the **current fact**, not the path taken to
  it. No changelog narration — never "now uses X instead of Y", "the old Z is
  gone", or a stale staging banner ("lives here until the real home exists"). By
  the time someone reads it, the transition is context noise; state what is.
- **The incident is not the reason.** A rule earns its place by what it
  prevents, stated in the present — never by the story of the time it was
  broken. Strip "three attempts each produced…", "this grew to 578 lines",
  "it arrived once…"; write the live consequence instead ("the other order
  overstates a real statement by 3.2%"), which is shorter and still a warning.
  This one hides behind *explain WHY*: a war story feels like rationale, but
  the rationale is what goes wrong **now**, not what went wrong once.
- The **one exception** is a doc whose whole job is the record: a dated audit
  trail or changelog explicitly logs what changed and why. If a doc isn't that,
  it reads as standing truth. **A commit message is that record** — history
  belongs there, which is why a doc never needs to carry it.
- **Don't enshrine a reconstructed or guessed value.** If you can't verify a real
  figure, ID, or path, ask for it — a plausible reconstruction committed as fact
  is worse than an obvious gap.
- **Verify an external source's recency *and* its content.** When you cite an
  outside reference, confirm both its last-updated date and that the *specific*
  thing you're citing actually changed — a page touch is not a content change.

## The shape of a doc

Voice governs the sentences; this governs what the doc is made of and what
order it comes in. The failures it catches are a doc whose reader reaches the
substance late, and a doc carrying three subjects under one name.

- **Lead with the substance.** The thing the doc exists to say comes first, and
  everything that merely orients the reader comes after it or not at all. Scope
  notes, boundary tables and ownership preambles are furniture: each is worth a
  line and none is worth the opening. The test is where the load-bearing content
  falls — if it is halfway down, the front half is furniture and should be
  shorter or moved.
  This and *open with purpose before method* above differ by scale: one line
  saying what the doc is for earns the opening, a screen of scope and ownership
  does not.
- **Get to the point inside a section too.** Say the thing, then qualify it. A
  paragraph that circles a point before landing it has spent the reader's
  attention on the approach.
- **A leaf doc carries no contents table.** Indexing what exists is the
  top-level `README`'s job, and a second index drifts from the first the day a
  doc is added. A leaf may link the siblings it genuinely depends on; it may not
  list them all.
- **One doc, one subject.** The name is the contract. Content that does not fit
  the name either means the content belongs elsewhere or the doc is misnamed,
  and both are fixed by moving something rather than by widening the name. This
  is the separation of concerns a module gets and a doc usually does not.
  *Never mint a doc for one rule* below is the same test at the other end: this
  catches a doc too broad for its name, that one a doc too narrow to deserve
  one.
- **Say what is out of scope, and link where it went.** A short *Out of scope*
  section naming the neighbouring subject and pointing at the doc that owns it
  is how a reader who arrived at the wrong document leaves quickly. Silence
  makes them read the whole thing to find out.
- **Link forward, not only outward.** When a section introduces something the
  same doc defines properly further down, link to it there. A reader who does
  not know the detail is coming either stops or reads on unsure whether they
  have missed it.
- **Give the best current answer, never "not built yet".** A section whose
  content is that nothing exists yet has no content. State what it will be, as
  the current best reading, and carry the open question wherever open questions
  are tracked — with a reference back here so the two stay attached.
- **No progress record, in either direction.** *State current truth* forbids
  narrating the past; the same applies forward. What is planned, what a round
  will tackle, what remains uncertain about the work itself: none of it is the
  subject, all of it goes stale, and it swamps the part a reader came for.
- **Headings name the thing, in as few words as carry it.** *Scope*, not *What
  this document owns and what it does not*. *Shape B*, not *Shape B — what it
  contains*. The extra words are read on every scan and earn nothing.

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

## Where a repo's own docs live

- **A rule about how the code works goes in a doc, never in the
  agent-instruction file.** `CLAUDE.md` / `AGENTS.md` is an index and a set of
  standing instructions, kept short precisely so it is read in full every
  session. A paragraph of design reasoning there is not documentation, it is
  rot: it pushes the instructions down the page, it is re-read by a machine on
  every unrelated task, and a human looking for that rule will never think to
  open it. Put the rule in the doc that owns the subject; the instruction file
  carries at most one line pointing at it.
- **Two standard docs, answering different questions.** A library carries
  `docs/how-it-works.md`, the MODEL — the rules that govern it, the definitions
  its behaviour turns on, its declared assumptions, and the reasoning behind any
  of them a reader would otherwise reopen. And `docs/api.md`, the REFERENCE —
  what is exported and what each name means. Subject docs sit alongside them
  (how figures are verified, where sources are archived). A rule of the model
  belongs in the first and is linked from the second.
- **Never mint a doc for one rule.** A file named after a single rule cannot
  grow, and it scatters the model across as many files as there are rules, so
  the next reader must find all of them to know how the thing behaves. Add a
  section to the model doc instead. The test: could a second rule of the same
  kind join this file without its name becoming a lie? If not, the name is too
  narrow and the file is a section wearing a filename.
- **Record the decision, not only the rule.** Where a rule is the survivor of a
  rejected alternative that cost real work — something built, measured and
  reverted — say so and say what it cost. A rule with no recorded reason gets
  reopened, and the argument is the only thing that stops it being proposed
  again. This is where *state current truth, not history* yields: why the code
  is the shape it is **is** current truth, unlike a narration of what it used to
  be.

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

## Diagrams

- **Prefer Mermaid** for diagrams — it renders on GitHub and in a VS Code Markdown
  preview (with a Mermaid extension). Reach for ASCII only when a diagram must
  render with zero tooling.
- **Theme-friendly styling.** A `classDef` sets the **border only**
  (`stroke` + `stroke-width`), never `fill` or `color` — a hardcoded fill fights
  the reader's light/dark theme (light nodes stranded on a dark canvas, or
  unreadable text). Let the node fill and text stay themed; encode meaning with
  the border colour.
- **`flowchart TB` by default** — top-down fits the page width; `LR` overflows a
  rendered doc.
- **Conservative syntax for portability.** Quote every node label; keep labels
  plain ASCII (no unicode arrows, dots, or circled numbers — they blank some
  parsers); avoid `direction` inside subgraphs. Use one palette per doc, with a
  one-line legend when colour carries meaning.

## Durability

- **Encode durable method, never point-in-time data** — percentages, search
  volumes, live ranking positions, or a specific current redirect belong in a
  dated output, not a standing doc. Ask "will this still be true next quarter?";
  if not, it's data, and it goes elsewhere.
- **A reference or interface doc is a stable spec.** It states current truth
  and never a guessed value, both of which *State current truth, not history*
  above already owns. This section adds two: don't editorialise a tool quirk
  as "the API is broken", and keep edits to minimal correctness fixes rather
  than expansions.
- **Name a doc or unit for the capability it provides**, verb-object
  (`archive-releases`, not `releases`) — a name is an action you invoke, not
  the noun it operates on.
- **88-column wrap** where prose allows. Don't hard-break a table row, URL, or
  link to hit it — those are the standard exceptions.
