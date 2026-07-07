---
name: typescript
description: >-
  TypeScript data, type, and component-variant design — typed
  identifiers, clean domain data, variants over mode flags
user-invocable: false
---

# TypeScript Data Modelling

## Intent

Govern TypeScript data, type, and component-variant design — typed identifiers,
clean domain data, variants over mode flags.

## Applies-to

`.ts` / `.tsx` — data, type, and component-API design. Preloaded as the rubric
wherever TS is written or reviewed (e.g. the `code-review` / `design-xray` agents
for `.ts/.tsx`). General formatting (line length, file naming) is out of scope.

## Owns-vs-defers

Owns the **design half** — data modelling, typed identifiers, value objects,
variants over mode flags, and crawlable-navigation design (a real `<a>`/`<Link>`,
not a JS-only handler). **Defers** mechanical rules to `eslint` (max-len, import
order, `@typescript-eslint`, sonarjs), and anchor *phrasing/flow* to the prose
reviewer — this rubric owns the element, not the wording.

Apply these principles when creating or restructuring types,
constants, domain data, or component variants in TypeScript /
TSX. (Scope: data, type, and component-API design — general
formatting such as line length and file naming is out of this
skill's scope.)

## Typed Identifiers

Use an `as const` object for domain keys, then derive the
union type from it — never pass bare `string` between
modules.

```ts
// Const object: human-readable keys, literal values
export const STATUSES = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
} as const;

// Derived union: 'draft' | 'published' | 'archived'
export type StatusId =
  (typeof STATUSES)[keyof typeof STATUSES];

// Ordered iteration from the same source
export const STATUS_IDS: StatusId[] =
  Object.values(STATUSES);

// Bad: hand-maintained union + separate array
type StatusId = 'draft' | 'published' | 'archived';
const STATUS_IDS = ['draft', 'published', 'archived'];
```

Call sites reference the const object for individual
lookups (`STATUSES.Draft`) and the derived array for
iteration.

## No Magic Literals

Repeated literals — route/page paths, storage keys, query
params, event names — belong in one exported constant,
imported at every call site. Never hardcode the same
literal across multiple files.

```ts
// Good: one source of truth, imported everywhere
export const ROUTES = { DASHBOARD: '/dashboard' } as const;
// pathname.startsWith(ROUTES.DASHBOARD)

// Bad: '/dashboard' copied across pages, nav, helpers
```

## Pass Value Objects, Not Loose Fields

When a function or component needs several fields a domain value
object already carries, accept the **object**, not its unpacked
fields. Spreading a rich type into a bag of `string`/`number`
parameters at the call boundary throws away the type system's
help, lets callers pass mismatched or stale values, and bloats
every call site. If a sibling helper already takes the object,
the new one should too — keep their interfaces parallel.

```ts
// Bad: a rich `Product` re-accepted as loose primitives
function priceSchema(opts: {
  name: string;
  sku: string;
  min: number;
  max: number;
}) { /* … */ }
priceSchema({name: p.name, sku: p.sku, min: p.low, max: p.high});

// Good: accept the value object; read its fields inside
function priceSchema(product: Product) { /* product.name … */ }
priceSchema(product);
```

The call site shrinks to one typed argument, and a field rename
on `Product` is caught by the compiler instead of silently
threading the wrong primitive through. Flag any helper whose
parameters duplicate the fields of a domain type already in
scope at every call site.

A list of parallel `min`/`max` (or other obviously-paired)
primitives **is** a value object you haven't named yet. Collapse
each pair into a small `Range`-style type and pass one argument per
span — even if you must define that type locally because no library
owns it yet. Repeated loose pairs are the smell; "the fields are
flat, so flat props are fine" is not a defence — the shape is the
unit, and a six-number parameter list hides three.

```ts
// Bad: three spans flattened into six parallel primitives
function forecast(opts: {
  tempMin: number; tempMax: number;
  humidityMin: number; humidityMax: number;
  windMin: number; windMax: number;
}) { /* … */ }

// Good: name the shape; one argument per span
interface Range {min: number; max: number}
function forecast(opts: {
  temp: Range; humidity: Range; wind: Range;
}) { /* … */ }
```

## Reuse the Library's Types and Values

Before defining a consumer-side type for a domain concept, check
whether the owning library already exports one — and use it, even
if it carries fields you don't need. A parallel interface that
mirrors a published type duplicates the contract and drifts from
it. The same goes for values: if the library exposes a function
or constant for a derivation, call it rather than recomputing the
formula inline, and reach for the library's named key/constant
instead of a bare literal.

```ts
// Bad: a parallel shape + a re-derived value the library owns
interface Bracket {floor: number; rate: number}
const bracket = {
  floor: cfg.bands[1].min + cfg.allowance,  // re-derived
  rate: cfg.bands[1].rate,
};

// Good: use the library's type and its accessor
const bracket: TaxBand = higherBand(cfg);   // library type
const floor = bandFloor(cfg);               // library fn
```

When the library's function is wrong or incomplete for your case,
fix it upstream rather than shipping a corrected copy in the
consumer. If you genuinely must bypass it, leave a comment saying
why — so the next reader doesn't "simplify" your code back into
the bug.

## Don't Wrap a Domain Object to Decorate It

When a caller needs a library's domain object *plus* a small
consumer-side extra — a display string, a presentation flag — pass the
object **as-is** and let the extra ride alongside in a thin sidecar (a
separate argument, or a small companion type). Don't envelope the
domain object in a consumer wrapper (`{ entity, label, … }`), and don't
stand up an "adapter" whose only job is to build that wrapper. A
wrapper re-boxes an object the library already models; an adapter is
ceremony around what is usually a one- or two-line compose against
accessors that already exist.

```ts
// Bad: a consumer wrapper around a good domain object, plus an
// adapter whose only job is to build the wrapper
interface DecoratedEntity { entity: Entity; badge: string }
function decorate(entity: Entity): DecoratedEntity { /* ceremony */ }
render(decorate(entity));

// Good: pass the raw library type; a thin companion carries the extra,
// composed at the one call site that needs it
interface EntityBadge { badge: string }         // the only new type
render(entity, { badge: badgeFor(entity) });
```

A new consumer type earns its place only when it carries a field the
domain object genuinely lacks — never when it merely re-describes one
the library owns. And model transient UI state (a selected index, an
open flag) as local state, not a named domain type: a small "selection"
type that only names which control is active is not a domain model.

## A Domain Rule Lives in the Library, on Every Path

A rule the domain owns — a statutory floor, a rounding
convention, a region-specific adjustment — belongs in the library
that owns the data, applied wherever that library produces the
affected value, never re-implemented or patched at a call site.
When a consumer appears to need the rule, the fix is upstream —
and it must cover **every** path the library exposes for that
value, not one. The trap is consolidating a shared transform into
a single path (a table build, one accessor) and dropping it from
another: a second path that still takes the raw value silently
skips the rule, and every consumer that reaches the value that way
is quietly wrong.

```ts
// Bad: the floor lives only in the table build; a second path
// that regionalises a raw base skips it and underpays.
const scale = buildScale(region);          // floor applied here
const gross = regionalise(rawBase, region); // …but not here

// Good: the rule is applied wherever a gross is produced, so
// both paths agree (the transform is idempotent, so it composes).
const gross = regionalise(rawBase, region); // floors + adjusts
```

So "one floor site, not two" is only safe if every consumer flows
through that one site. Before removing a transform from a path
because "another path already does it," confirm no caller reaches
the value the first way — otherwise keep it on both (idempotent
transforms compose safely) and guard the pair with a test (below).

## Keep Shared Modules Presentation-Agnostic

A module in a shared or `lib` layer holds data, domain logic, and
pure transforms — not user-facing copy or framework concerns.
Display strings (labels, prompts, headings), markup, and the
assembly of a component's props belong in the presentation layer.
A lib function that returns a sentence a user will read, or builds
view props, has crossed the boundary: return plain data and let
the presentation layer render it. This keeps the shared module
reusable and the copy where designers expect it.

## Variants over Mode Flags

When a unit varies along a small fixed axis of behaviour,
model each variant explicitly — don't thread a stringly-typed
`mode` flag through the body. A `mode: 'a' | 'b'` string pushes
a runtime branch into the body, duplicates logic across
branches, and leaks an untyped contract callers must decode.
Prefer distinct named variants (or a typed-constant-keyed
config) so callers select intent **by type, not a magic
string**.

```ts
// Bad: a magic-string mode + an internal branch
function label(id: ItemId, mode: 'short' | 'long') {
  return mode === 'long' ? LONG[id] : SHORT[id];
}

// Good: distinct variants; the caller picks intent by name
export const shortLabel = (id: ItemId) => SHORT[id];
export const longLabel = (id: ItemId) => LONG[id];
```

When variants share structure, keep the shared part in one
place and let each variant carry only its *difference*. For
React components, the Server→Client boundary adds a constraint
— see the next section.

## Component Variants & the Server/Client Boundary

The same rule applies to React components, with a runtime
twist: you **cannot pass a function** (event handler, render
prop) from a Server Component to a Client Component —
non-serializable props are rejected at that boundary, and it
fails late. So when a client component's behaviour varies and
its host is a server component, you can't inject a callback
from the page. Two correct options:

1. a **serializable discriminator** (a typed constant, never a
   bare string) the client switches on internally; or
2. **(preferred when variants are cohesive)** distinct client
   **subtype components**, each injecting its behaviour into a
   shared client **shell**. Function injection is fine
   client→client, so the shell stays DRY and the server page
   imports the variant it needs.

Choose (2) when the variants render genuinely **different
elements** — e.g. a `<button onClick>` vs a crawlable
`<a href>`; a single mode-switch can't unify those without
losing one's semantics (you'd downgrade the link to a JS
click).

```tsx
// Bad: magic-string mode + branch + duplicated styling
function Widget({mode}: {mode: 'link' | 'action'}) {
  return mode === 'link'
    ? <Link href="/x" className={CTA}>Go</Link>
    : <button onClick={doThing} className={CTA}>Go</button>;
}

// Good: shared shell, behaviour injected per subtype
function WidgetShell(
  {renderCta, ...rest}: Props & {renderCta: (s: Sel) => ReactNode},
) {
  return <div>{/* shared state + UI */}{renderCta(selection)}</div>;
}

export function LinkWidget(props: Props) {
  return <WidgetShell {...props} renderCta={(s) =>
    <Link href={s.href} className={CTA}>Go</Link>} />;
}

export function ActionWidget(props: Props) {
  const onThing = useCallback(/* … */, []);
  return <WidgetShell {...props} renderCta={(s) =>
    <button onClick={() => onThing(s)} className={CTA}>Go</button>} />;
}
```

`CTA` is one shared class constant — each variant carries only
its difference (element + behaviour), never a copy of the
styling. Flag: a `mode`/`variant` string prop with an
`if (mode === …)` branch; a callback passed to a client
component from a server component; duplicated markup across
branches instead of one shared shell.

## Separate Static from Varying

Metadata that doesn't change per variant (labels, slugs,
descriptions) belongs in one constant keyed by the typed
ID. Data that varies (figures, rates, thresholds) goes in
a separate structure, also keyed by the same typed ID.

```ts
// Static: one place, never duplicated across periods
const INFO: Record<ItemId, ItemInfo>;

// Varying: one constant per period, data only
const DATA_2025: Record<ItemId, DataPoint[]>;
const DATA_2026: Record<ItemId, DataPoint[]>;
```

Adding a new period means adding one data constant — not
copying labels, slugs, and descriptions.

## No Legacy Shapes

When migrating data from YAML, JSON, or CSV, design types
for TypeScript consumers — don't mirror the source format.
Ask: "How will call sites consume this?" not "What did the
spreadsheet look like?"

- Arrays of objects with redundant keys → `Record` keyed
  by typed ID
- Wrapper objects with only one useful field → flatten
- String enums matching column headers → domain union types

## Flat over Nested

Prefer a typed `Record` over deeply nested wrapper objects
unless nesting models real containment (e.g. a parent
genuinely owns its children).

```ts
// Good: flat lookup, typed key
const items: Record<ItemId, Detail[]>;

// Avoid: unnecessary nesting
const data: { items: { id: string; details: ... }[] };
```

## Don't Swallow Exceptions

A bare `catch {}` discards the error and hides real failures. A
caught error is typed `unknown` — report it, then decide whether
to recover or rethrow. Never leave an empty catch.

```ts
// Good: surface the failure, then degrade
try {
  return parseConfig(raw);
} catch (error) {
  reportError(error, { context: 'parse_config' });
  return null;
}

// Bad: the failure is now invisible
try {
  return parseConfig(raw);
} catch {
  return null;
}
```

Empty catches are acceptable only for expected, benign cases
(e.g. `localStorage` in private mode) — and then add a comment
saying why. Otherwise route caught errors to your app's error
reporter rather than swallowing them.

## Guard Cross-Path Invariants with a Test

When two code paths must produce the same result — a value derived
two ways, a fast path against a reference path, a consumer's
computation against the library's — assert **path A equals path
B**, not just each path against its own fixture. A fixture pins
one path; only the equivalence test catches a refactor that
changes one and leaves the other, which is exactly how a
"consolidate into one site" change silently diverges the two.

```ts
// A fixture pins the table path but never exercises the other:
expect(scaleFor(region).points[0]).toBe(EXPECTED); // one path only

// The equivalence test fails the moment the two paths disagree:
expect(regionalise(rawBase, region))
  .toBe(scaleFor(region).points[0]);  // path A === path B
```

Where the result is externally knowable, add an **oracle**
assertion to the concrete figure with its source cited **inline
at the assertion** — a test module is a verification document, so
the reference belongs at the exact line it verifies, not in a
header. That turns the test from "the code agrees with itself"
into "the code agrees with the world".

```ts
// £X is the 2026-27 statutory floor, per <issuing body>,
// circular <id> (<date>): <reference>. A base below it is lifted.
expect(regionalise(belowFloor, region)).toBe(FLOOR_FIGURE);
```

## Pin Transcribed Reference Data to a Cited Fixture

When you transcribe an external table into code — pay scales, tax
thresholds, statutory rates — commit a fixture that mirrors the
authoritative table (one row per value, the **source cited**) and
assert the code against it. A code-vs-code check (a value equals a
recomputation, or a hardcoded `toBe`) proves internal consistency,
not correctness: a whole table transcribed on a wrong factor is
perfectly consistent and still wrong — only a fixture tied to the
published source catches a bad transcription.

```ts
// Weak: the "expected" is transcribed from the same place as the
// code, so a shared transcription error hides — both agree, both wrong.
expect(rateFor('a5')).toBe(42_000);           // code-vs-code

// Strong: assert every code value against a source-cited fixture,
// so a re-transcription on a wrong factor fails here.
for (const row of parse(readFileSync('scales.csv'))) {
  expect(rateFor(row.key)).toBe(Number(row.value));  // vs source
}
```

A **uniform offset across an entire table** — every value high by
the same fraction — is the signature of a wrong transform: a
mis-applied uplift, a rounding, a unit slip. Treat it as a data bug
and re-check the factor against source, not as noise.

(Complements *Guard Cross-Path Invariants with a Test* above: that
pins one externally-known figure with an inline oracle; this pins a
whole transcribed table to a committed, cited fixture.)
