---
name: typescript
description: >-
  TypeScript data modelling and type design — typed
  identifiers, clean domain data, structured constants
user-invocable: false
---

# TypeScript Data Modelling

Apply these principles when creating or restructuring types,
constants, or domain data in TypeScript. (Scope: data and type
design — general formatting such as line length and file naming is
out of this skill's scope.)

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
