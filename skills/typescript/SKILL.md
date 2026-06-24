---
name: typescript
description: >-
  TypeScript data, type, and component-variant design — typed
  identifiers, clean domain data, variants over mode flags
user-invocable: false
---

# TypeScript Data Modelling

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
