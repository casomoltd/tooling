# Skill / agent authoring schema

*The house standard for authoring a Claude Code skill or agent. Read this when
creating or editing one. It is the interface vocabulary that lets units compose
without colliding — and the decision table that says which shape a given unit
should take.*

Author a skill or agent as a **modular unit with a declared interface**, so units
compose without overlap. The vocabulary below is **soft, not a rigid template** —
which sections carry weight depends on the unit's *profile* (see the decision
table). Include the **interface** sections whenever the unit composes with others;
a tiny standalone skill may carry only Intent + Method.

## The interface vocabulary

- **Identity** — `name` (verb-object) + `description` (3rd-person imperative;
  **positive + negative** triggers — when to invoke *and* when NOT). *Dispatch.*
  (interface)
- **Intent** — the single job, one line, a **distinct verb**. The contract that
  makes overlap visible. (interface)
- **Scope** — in / out, plus a one-line seam to each sibling. (interface)
- **Inputs** — data sources (IDs/schema), files, prior artefacts, params, plus
  **validation** (required/optional, limits, reject rules) — what it reads.
  (interface)
- **Outputs** — artefacts/files, **which fields/artefacts it OWNS vs merely
  reads**, hand-offs, and **post-conditions** (what the output must satisfy before
  done). *Where write-ownership is declared.* (interface)
- **Method** — numbered steps or rules; keep it **slim + procedural** — push heavy
  reference (ID tables, schemas, rubrics) into a Reference section/file loaded
  just-in-time, off the spine (progressive disclosure).
- **Guardrails** — invariants ("never X").
- **Boundaries** — "vs `<sibling>` → use `<Y>`" (the composition graph).

**Name units verb-object** (a capability, like `play-piano`, not `piano`); a tight
`description` gates auto-invocation.

## Three profiles — pick by frontmatter

A unit is one of three kinds, and the kind is **inferable from its frontmatter**.
Use this table to pick the profile deterministically, then lean on the sections
that are load-bearing for it. This is the trigger that keeps the schema applied to
the *right* unit — an agent shouldn't be judged for lacking a numbered Method, and
a style guide shouldn't be forced to fake `## Inputs`.

| If the unit… | Profile | Load-bearing sections |
|---|---|---|
| lives in `agents/` + has `tools:` | **agent** — *called as a function* | **Inputs** (a near-signature: "the caller provides…") → **Output** (a defined return shape the caller parses); Boundaries expressed as "owned elsewhere" |
| has `user-invocable: false` and/or a `paths:` glob | **standard / rubric** — *preloaded as reference* | **Intent** (1 line) · **Applies-to** (the surface it governs) · **Owns-vs-defers** (rules it owns vs a sibling/linter). The body stays the ruleset — that *is* its Method |
| has `user-invocable: true` + `argument-hint` + `allowed-tools` | **procedural skill** — *dispatched by intent* | **Intent** · **Scope** · numbered **Method** · **Boundaries** · **Guardrails**; Inputs/Outputs where it composes |

### agent — Inputs → Output

An agent is *called as a function*: its `description` is a capability + when-to-use
(with `tools` / `model` / `skills` in frontmatter), its **Inputs** read as a
near-signature ("the caller provides: …"), and its **Output** is a defined return
shape the caller parses. It leans on **Inputs → Output**. Declare Inputs
explicitly rather than burying them in Scope — the caller is coding against them.
`design-xray` and `code-review` model this: each opens with `## Inputs` (the target
+ the rubrics it preloads) and ends with a fixed `## Output` shape.

### standard / rubric — the inverted interface

A rubric (`python-style`, `typescript`, `frontend-design`) is not invoked to
produce an artefact; it is **preloaded as a rubric** by a consumer (an agent's
`skills:` list, or an editor loading it before writing code). Its interface is
therefore *inverted* — declare it with three short lines above the ruleset body:

- **Intent** — one distinct verb ("govern TypeScript data/type/variant design").
- **Applies-to** — the surface it governs (`**/*.py`; `.ts` / `.tsx`). Often
  already encoded as the `paths:` frontmatter.
- **Owns-vs-defers** — the rules this rubric owns vs those a sibling or linter
  owns. This is the rubric's analogue of Outputs-with-ownership: it stops two
  rubrics (or a rubric and a linter) from double-flagging the same thing. E.g.
  `typescript` owns data/type/variant + crawlable-navigation design; `eslint` owns
  the mechanical rules; a prose reviewer owns anchor *phrasing*.

The body remains the ruleset itself — that is the rubric's Method; don't add a
second procedural Method on top of it.

### procedural skill — Intent + Method + Boundaries

A skill is *dispatched by intent* — its `description` is a router (trigger phrases
+ when-NOT + sibling redirect). It leans on **Intent + Scope**, a numbered
**Method**, and explicit **Boundaries**. Push heavy reference off the spine.

## Composition — Outputs-with-ownership

**Declaring Outputs-with-ownership makes a write-collision self-evident:** two
units that both write the same field/artefact each list it, so you assign one
owner. The same move works across all three profiles — a procedural skill's
Outputs, an agent's Output shape, a rubric's Owns-vs-defers.

The composition graph is the point. Some `tooling`-native seams:

- **`commit` ↔ `release-version`** — `commit` runs checks, stages, and commits, and
  *stops*; the release tail (bump → push → publish/deploy) is `release-version`.
  Each states the seam in its Boundaries so neither drifts into the other's lane.
- **`design-pass` → `design-xray` → `code-review`** — the `design-pass` skill
  orchestrates two agents: `design-xray` returns a structural map + a ranked
  refactor-target handoff, which `code-review` then judges file-by-file. The
  handoff table *is* the interface between them.
- **`python-style` / `typescript` vs `eslint` / `ruff`** — the rubrics own the
  design-judgment half; the linters own the mechanical half. `code-review`'s
  "Ignore — owned elsewhere" section names that seam so it never re-flags a lint
  rule.

**Reference material lives in interface docs, not always-loaded context.** When a
unit's Inputs/Outputs reference a schema, a data layout, or an ID table, point at a
canonical interface doc (like this one) loaded just-in-time — don't inline the heavy
reference onto the unit's spine, and don't duplicate it into always-on context.

## Enforcement

The **mechanical** half of this schema is linted, not just trusted:
`bin/skills-lint.config.mjs` runs stock remark (`remark-frontmatter` +
`remark-validate-links` + `remark-lint-frontmatter-schema`) to verify every
skill/agent's frontmatter parses and carries `name` + `description`, and that every
cross-link and `#anchor` resolves. `npm run check` (`lint:skills`) runs it over the
`skills` tree and this `docs` tree, so a rename or hand-edit that breaks a link —
the kind Claude Code's loader silently swallows — fails the build.

The **judgment** half stays human-reviewed — a linter can't check it:

- **profile fit** — is each unit shaped to the right profile (the decision table
  routes it, but a human confirms the load-bearing sections are actually there)?
- **Intent distinctness** — does each unit have one distinct verb, or do two units
  overlap?
- **Outputs-ownership** — does exactly one unit own each field/artefact/rule?
- **sibling seams** — does every Boundaries line point at a real sibling?
