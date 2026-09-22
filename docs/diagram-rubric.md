# Diagram rubric

*The rules that hold for **any** mermaid block, whatever renders it. Three
units emit mermaid — [`design-xray`](../agents/design-xray.md),
[`docs-xray`](../agents/docs-xray.md) and
[`draft-design-spec`](../skills/draft-design-spec/SKILL.md) — and each cites
these rules by identifier rather than restating them.*

## Parser safety

These fail the same way everywhere: the block does not parse, or it parses
into something other than what was meant.

- **M1 — No `|`, `[`, `]`, `,` or `~` inside a label or a member line.** They
  are mermaid syntax. This is the commonest way a generated block dies.
- **M2 — Write a type in words.** `date or None`, not `date|None`. `list of
  Item`, not `list[Item]`. `Callable str to str`, not `Callable[[str], str]`.
  A type alias's shape goes in prose inside the class body.
- **M3 — Short alphanumeric ids, the human label quoted.**
  `readme["README.md"]`. An id carrying punctuation is an id that breaks.
- **M4 — Ids are unique case-insensitively.** `Foo` and `foo` collapse into one
  node, silently, and the diagram is then wrong rather than broken.
- **M5 — No parentheses in a label or a relationship label.** A doc title or
  a method signature carrying one is common, and it breaks the same way the
  brackets in M1 do.
- **M6 — No prose outside node and edge lines.** A sentence that wandered into
  the block is a syntax error with a confusing message.
- **M7 — Every node carries at least one edge.** A floating node reads as an
  omission and distracts from the ones that mean something.
- **M8 — Validate that the block parses before returning it.** Rendering is the
  only real check; a block that has never been rendered has never been tested.

## Composition

True of a diagram in any context, because they are about what the reader can
follow rather than about what the parser accepts.

- **M9 — Top-down by default.** A left-to-right chain runs several times the
  width of the same graph drawn `TD`, and vertical usually matches the
  metaphor: a ledger is stacked rows, a pipeline is stages.
- **M10 — Short node labels; the detail goes in the legend.** Past a point,
  width is set by how many nodes sit in the widest rank, not by label length —
  when trimming text stops helping, merge nodes or split the figure.
- **M11 — A legend is a key, not an inventory.** It maps symbol to meaning and
  stops. It never lists which nodes carry a symbol; the reader can see that.
- **M12 — Never repeat in a node what an adjacent table already states.** One
  representation per fact, and it buys width for free.

## Out of scope

Rendering context is not shared, so each unit owns its own:

| Concern | Owner | Why it cannot be shared |
|---|---|---|
| Stereotype escaping | [`bin/render-figures.mjs`](../bin/render-figures.mjs) | An author writes `<<abstract>>` literally everywhere. A spec's figures are pre-rendered, and the renderer escapes the source before mermaid parses it, so no authoring rule is needed. It would be needed if a spec ever shipped a live mermaid runtime, which `spec-check` refuses. |
| Width budget | [`bin/spec-check.mjs`](../bin/spec-check.mjs) | Only the published artefact has a fixed content box to overflow. |
| A mermaid runtime, and `click` directives | [`bin/spec-check.mjs`](../bin/spec-check.mjs) | Only the artifact host ships a competing runtime and a CSP that drops the handler. |
| Colouring a `classDiagram` | [`draft-design-spec`](../skills/draft-design-spec/SKILL.md) | `classDef` parses and does not paint there, so nodes need per-node `style`. A defect only that renderer has. |
