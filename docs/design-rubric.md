# House design & architecture rubric

The **software architecture** lens behind the house standards — language- and
platform-agnostic (a library, a service, a CLI, a UI). It exists to be run **up
front**: most design churn is discovering, over review rounds, that a proposed
type was an unneeded wrapper, that a second producer should have been unified, or
that a concern sat in the wrong layer. Designing to the lens first collapses
those rounds.

The enforceable, example-backed **rules** live in the language standards
([`typescript`](../skills/typescript/SKILL.md),
[`python-style`](../skills/python-style/SKILL.md)); this doc does **not** restate
them — it is the cross-cutting lens and an index into them. Applied by
[`draft-design-spec`](../skills/draft-design-spec/SKILL.md),
[`design-pass`](../skills/design-pass/SKILL.md), and the `design-xray` /
`code-review` agents.

## The review lens

Before proposing a type, an interface, or a module, ask:

1. **Does the library already give me this** — the object, the computation, the
   identity? Reach for the existing type / resolver / factory first.
2. **Is there more than one producer of the same value?** If so, unify — extend
   the library so every path consumes it; don't keep a shadow implementation
   honest by discipline + a test.
3. **What is the smallest thing that must cross this boundary?** Usually just the
   domain object — not a struct bundling it with presentation options, a
   serialization payload, and human-facing labels. Return a typed value object.
4. **Is each concern in its own layer?** Computation → the domain / library;
   presentation → the layer that renders (the core stays presentation-agnostic);
   configuration / shared state → the shared store, not duplicated locally;
   identity / serialization of a domain object → the library.
5. **Am I inventing a type the domain object already implies?** If the object
   carries the data — or defaults it — don't wrap it or pass a sidecar. Optional
   inputs default (to none / zero / identity); don't require or thread them.

Plus one sequencing rule: **foundations first, features on top** — land the
domain / library correctness before the features that consume it, not the reverse.

## The rules behind the lens

Each lens question is enforced by a named rule in the language standards. Cite
those **by name**; don't restate them here.

- **Q1 · Q2 — library-first, one producer** → `typescript`: *Reuse the Library's
  Types and Values* · *Don't Wrap a Domain Object to Decorate It* · *A Domain Rule
  Lives in the Library, on Every Path*. `python-style`: **Design** (SoC,
  framework-first, no re-implemented domain logic).
- **Q3 — thinnest interface, typed returns** → `typescript`: *Pass Value Objects,
  Not Loose Fields* · *Separate Static from Varying*.
- **Q4 — a concern per layer, presentation-agnostic core** → `typescript`: *Keep
  Shared Modules Presentation-Agnostic*.
- **Q5 + fail-loud — no silent default, polymorphism, EAFP** → `typescript`: *No
  Silent Default for a Domain-Selecting Input* · *Variants over Mode Flags* ·
  *Once Dispatched, Don't Re-Ask the Type* · *Don't Swallow Exceptions*.
  `python-style`: **Design** (value objects, EAFP, polymorphism).
- **Unifying two paths** — when you must temporarily keep two, `typescript`:
  *Guard Cross-Path Invariants with a Test* (retire it once unified).

## See also

Platform / interface craft (UI/UX affordances, component boundaries) is out of
scope here — it lives in its own standards, such as
[`frontend-design`](../skills/frontend-design/SKILL.md).
