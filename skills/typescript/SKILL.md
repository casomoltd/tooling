---
name: typescript
description: >-
  TypeScript data, type, and component-variant design on top of
  code-style — typed identifiers, clean domain data, component variants
  across the server/client boundary, the environment resolved once into
  a closed set, and keeping a content document (MDX) to words
user-invocable: false
---

# TypeScript Data Modelling

## Intent

Govern TypeScript data, type, and component-variant design on top of the house code standard, [`code-style`](../code-style/SKILL.md) — typed identifiers, clean domain data, component variants, where the program is running resolved once into a closed set of shapes, and a content document kept to words.

## Applies-to

`.ts` / `.tsx` — data, type, and component-API design — and a content document (`.mdx`) that places those components. Preloaded with `code-style` wherever TS is written or reviewed (e.g. the `code-review` / `design-xray` agents for `.ts/.tsx`, and `code-review` alone for `.mdx`). General formatting (line length, file naming) is out of scope.

## Owns-vs-defers

Owns the **TypeScript design half** — data modelling, typed identifiers, component variants, crawlable-navigation design (a real `<a>`/`<Link>`, not a JS-only handler), a hand-written utility class against the framework's utilities, and a content document kept to words. **Defers** the rules every language shares to `code-style`, which this standard applies on top of, mechanical rules to `eslint` (max-len, import order, `@typescript-eslint`, sonarjs), and anchor *phrasing/flow* to the prose reviewer — this rubric owns the element, not the wording.

## TypeScript Forms of code-style's Rules

Where TypeScript changes how a [`code-style`](../code-style/SKILL.md) rule is met:

- **The size limits are lint errors** ([Keep a Function to One Screen](../code-style/SKILL.md#keep-a-function-to-one-screen)), set in [`eslint/house-rules.mjs`](../../eslint/house-rules.mjs). Lint skips a file listed in `eslint-suppressions.json`, so the rubric holds the same limits there.
- **Module order needs no declarations** ([Lay Out a Module Top-Down](../code-style/SKILL.md#lay-out-a-module-top-down)). A consumer reads the generated `.d.ts` and the package's barrel, and a `function` declaration is hoisted, so an exported function can call a helper defined below it. Constants and classes are not hoisted: a module-level `const` whose initialiser reads another `const` defined below it throws at import (the temporal dead zone). A type derived from a constant (`(typeof X)[keyof typeof X]`) sits beside that constant rather than in the types block, as [Typed Identifiers](#typed-identifiers) shows.
- **A literal's name is an exported `const`**, an `as const` object for a family of them ([No Magic Literals](../code-style/SKILL.md#no-magic-literals)): `export const ROUTES = { DASHBOARD: '/dashboard' } as const;`. Where a library owns the value, import it: [Reuse the Library's Types and Values](#reuse-the-librarys-types-and-values).
- **A variant is a function or component per case** ([Variants over Mode Flags](../code-style/SKILL.md#variants-over-mode-flags)), never a `mode: 'a' | 'b'` string parameter. In React the Server/Client boundary limits how behaviour is injected: [Component Variants & the Server/Client Boundary](#component-variants--the-serverclient-boundary).
- **Type each implementation to its own case** ([Once Dispatched, Don't Re-Ask the Type](../code-style/SKILL.md#once-dispatched-dont-re-ask-the-type)): `const circleArea: AreaOf<Circle>`, not a handler taking the whole `Shape` union and narrowing `s.kind`. Dispatch through a `Record<Kind, Impl>` lookup. Then `@typescript-eslint/no-unnecessary-condition` flags a now-redundant tag check, and a `no-restricted-syntax` selector can ban `switch`/`.kind ===` inside a `variants/` or `families/` dir.
- **A selector is a required parameter** ([No Silent Default for a Domain-Selecting Input](../code-style/SKILL.md#no-silent-default-for-a-domain-selecting-input)): no `= 'gb'`, no `?? first`, no `[0]`. Declare absence on the way out with a union arm, so a `Record<Id, Listing>` stays total and a forgotten entry is a compile error: `type Listing = Variant[] | {carried: false; reason: string}`.
- **The layer rules decide first** ([One Concern, One Module](../code-style/SKILL.md#one-concern-one-module)): [A Fact Belongs to the Layer That Owns Its Meaning](#a-fact-belongs-to-the-layer-that-owns-its-meaning) and [A Calculation Package Holds No Presentation](#a-calculation-package-holds-no-presentation) settle a split between layers before any merge. [A Library Takes Only What Its Rule Needs](../code-style/SKILL.md#a-library-takes-only-what-its-rule-needs) is the domain-layer case of [Keep Shared Modules Presentation-Agnostic](#keep-shared-modules-presentation-agnostic).
- **A caught error is `unknown`** ([Don't Swallow Exceptions](../code-style/SKILL.md#dont-swallow-exceptions)): narrow it before reading it, or pass it whole to the error reporter. An empty `catch {}` is the swallow.

## Typed Identifiers

Use an `as const` object for domain keys, then derive the union type from it — never pass bare `string` between modules.

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

Call sites reference the const object for individual lookups (`STATUSES.Draft`) and the derived array for iteration.

## Name the Condition, Not the Branch

When a reader needs a comment to know what a branch tests, bind the condition to a `const` whose name states the case, and branch on that. The name sits at the test, so it cannot drift from it the way a comment above it can. TypeScript narrows through a `const` condition as it does through the expression, provided the value it narrows is itself a `const`, a readonly property or an unreassigned parameter. Keep a comment only for *why* the branch exists.

```ts
// Good: the name states the case, and `order.coupon` still narrows
const firstOrderDiscount =
  order.coupon !== undefined && customer.orderCount === 0;
if (firstOrderDiscount) return applyCoupon(order.coupon);

// Bad: the comment says what the condition should have said
// A new customer's first order, with a coupon
if (order.coupon !== undefined && customer.orderCount === 0) {
  return applyCoupon(order.coupon);
}
```

## Name a Value for Whose It Is

When two values of the same unit sit side by side, each name says whose it is or which it is. A per-record figure named like a shared default reads as one, and the reader cannot tell which to change.

```ts
// Good: the customer's own limit and the shop's default are told apart
const customerCreditLimit = account.override ?? defaultCreditLimit;

// Bad: the same expression; is `limit` the customer's or the default?
const limit = account.override ?? defaultCreditLimit;
```

Why this is not covered by [One Value for Two Facts That Usually Agree](#one-value-for-two-facts-that-usually-agree): that rule is one value answering two questions; this one is two values a single name could mean.

## A Domain Term Cites Its Definition

A term of art reads like plain English but means something narrower, and the gap is where a reader goes wrong. So a name taken from the domain's own vocabulary (a statute, a regulator's manual, a standard) carries a doc comment that cites where the term is defined, quoting it rather than paraphrasing, and says what it covers in this code. The citation lets the reader check the name against the definition instead of guessing at it.

Cite once, at the type or function that introduces the term; the other names that use it link to that comment.

```ts
// Good: the term, its source quoted, and what it is here
/** One holding's values over a settlement window. "Settlement window" is
 *  defined in the Example Settlement Act, s.4 (<source URL>): "the period
 *  in which a trade may be settled without a late fee". */
export interface SettlementWindow { /* … */ }

// Bad: a term of art with nothing to say it is one
/** A holding's window. */
export interface SettlementWindow { /* … */ }
```

The provenance rule ([Pin Transcribed Reference Data to a Cited Fixture](../code-style/SKILL.md#pin-transcribed-reference-data-to-a-cited-fixture)) cites the source of a figure; this one cites the source of a word.

## Carry a Stated Answer; Don't Infer It

Where the source states a fact (a yes/no on a form, a figure on a document), the input carries it as given and the code reads it. Deriving it from another field by a threshold or a proxy guesses what was never in doubt, and guesses wrong at the edge.

```ts
// Good: the answer the customer gave decides the rate
const rate = signup.isBusiness ? BUSINESS_RATE : CONSUMER_RATE;

// Bad: a proxy decides it, and a business with no VAT number pays the
// consumer rate
const rate = signup.vatNumber !== undefined ? BUSINESS_RATE : CONSUMER_RATE;
```

## Kill the Bug Class, Don't Guard the Instance

When a defect comes from two values being **independently settable**, the fix is not a validator. Remove the state that can disagree.

A measurement and the date it was taken at, held as separate fields, let a caller pair a fresh figure with a stale date — a shape a guard can catch and a type can forbid. Ask for the two **together**, as one value that lands or doesn't, and the broken state has nowhere to live: the guard becomes unnecessary rather than merely present.

The same move applies to a value **derived twice**. Two producers of one number agree by luck, not construction, and drift the moment either side's arithmetic changes. Watch for one quantity rounded, floored or converted independently at several call sites — a display, a table, that table's own comparison, a summary, a control. It only takes one of them to be wrong for the rest to be waiting to disagree, and the count of sites is the count of future defects. **One exported producer fixes all of them and makes the next one impossible.**

Before writing a check that two things match, ask why there are two.

## Reuse the Library's Types and Values

Before defining a consumer-side type for a domain concept, check whether the owning library already exports one — and use it, even if it carries fields you don't need. A parallel interface that mirrors a published type duplicates the contract and drifts from it. The same goes for values: if the library exposes a function or constant for a derivation, call it rather than recomputing the formula inline, and reach for the library's named key/constant instead of a bare literal.

```ts
// Bad: a parallel shape + a re-derived value the library owns
interface Tier {floor: number; charge: number}
const tier = {
  floor: cfg.tiers[1].min + cfg.baseCharge,  // re-derived
  charge: cfg.tiers[1].charge,
};

// Good: use the library's type and its accessor
const tier: ShippingTier = upperTier(cfg);   // library type
const floor = tierFloor(cfg);                // library fn
```

When the library's function is wrong or incomplete for your case, fix it upstream rather than shipping a corrected copy in the consumer. If you genuinely must bypass it, leave a comment saying why — so the next reader doesn't "simplify" your code back into the bug.

## Don't Wrap a Domain Object to Decorate It

When a caller needs a library's domain object *plus* a small consumer-side extra — a display string, a presentation flag — pass the object **as-is** and let the extra ride alongside in a thin sidecar (a separate argument, or a small companion type). Don't envelope the domain object in a consumer wrapper (`{ entity, label, … }`), and don't stand up an "adapter" whose only job is to build that wrapper. A wrapper re-boxes an object the library already models; an adapter is ceremony around what is usually a one- or two-line compose against accessors that already exist.

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

A new consumer type earns its place only when it carries a field the domain object genuinely lacks — never when it merely re-describes one the library owns. And model transient UI state (a selected index, an open flag) as local state, not a named domain type: a small "selection" type that only names which control is active is not a domain model.

## Don't Weaken a Type to Silence the Compiler

`Record<K, V>` relaxed to `Partial<Record<K, V>>`, a union widened, a field made optional, a non-null assertion added — each is legitimate when it models something real, and each is also the fastest way to make an error go away. They are not distinguishable by looking at the diff: both arrive as a small type edit that turns the build green.

The rule [*fix issues, don't disable checks*](../../docs/quality-gates.md#fix-issues-dont-disable-checks) is usually read as being about config — `strict: false`, `skipLibCheck`. It applies with equal force one level down. Relaxing a type is disabling a check; the check is just narrower and the config file is untouched.

Ask what the compiler was protecting. A total `Record` was asserting that every key has an answer — genuinely useful, because it makes a forgotten key a build error. If reality is that some keys have no value, say so **in the type** rather than by removing the guarantee: a union with an explicit "none, and here is why" arm keeps the record total and keeps the error.

Weakening is right when the old type was lying — when it forced a value that does not exist, and code was inventing one to satisfy it. That is a real argument, and it belongs in a comment at the site, so the next reader can tell it from a build-green edit.

Flag: a type relaxed in the same change that a compiler error appeared, with no note saying what the old shape was asserting and why that claim was wrong.

## Keep Shared Modules Presentation-Agnostic

A module in a shared or `lib` layer holds data, domain logic, and pure transforms — not user-facing copy or framework concerns. Display strings (labels, prompts, headings), markup, and the assembly of a component's props belong in the presentation layer. A lib function that returns a sentence a user will read, or builds view props, has crossed the boundary: return plain data and let the presentation layer render it. This keeps the shared module reusable and the copy where designers expect it.

## Component Variants & the Server/Client Boundary

[Variants over Mode Flags](../code-style/SKILL.md#variants-over-mode-flags) applies to React components, with a runtime twist: you **cannot pass a function** (event handler, render prop) from a Server Component to a Client Component — non-serializable props are rejected at that boundary, and it fails late. So when a client component's behaviour varies and its host is a server component, you can't inject a callback from the page. Two correct options:

1. a **serializable discriminator** (a typed constant, never a bare string) the client switches on internally; or
2. **(preferred when variants are cohesive)** distinct client **subtype components**, each injecting its behaviour into a shared client **shell**. Function injection is fine client→client, so the shell stays DRY and the server page imports the variant it needs.

Choose (2) when the variants render genuinely **different elements** — e.g. a `<button onClick>` vs a crawlable `<a href>`; a single mode-switch can't unify those without losing one's semantics (you'd downgrade the link to a JS click).

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

`CTA` is one shared class constant — each variant carries only its difference (element + behaviour), never a copy of the styling. Flag: a `mode`/`variant` string prop with an `if (mode === …)` branch; a callback passed to a client component from a server component; duplicated markup across branches instead of one shared shell.

## Crawlable Navigation

Primary navigation, and any hub-to-spoke or page-to-page link, renders a real `<a href>` or `<Link>`. A JS-only `onClick`, `router.push` or `<select>` emits no anchor, so the link is invisible to crawlers and answer engines. A mode flag that downgrades a link to a handler is the case [Component Variants & the Server/Client Boundary](#component-variants--the-serverclient-boundary) settles. Flag too hardcoded prose in a component that names another internal page or route in plain text with no `<Link>` on that phrase: the reference must be a crawlable anchor.

## A Project's Own Class Must Not Shadow a Framework Utility

A class the project defines and a framework utility that set the same property conflict silently, by source order. In Tailwind: where a project defines its own `text-*` or `bg-*` class that sets more than one property, a type ramp setting `font-size` **and** `font-weight`, say, pairing it with a framework utility for the *second* property ties on specificity and loses on source order. The utility is present, readable, and does nothing. Mark the utility with the framework's importance marker (`!`), or delete the redundant class.

Two relatives fail the same silent way:

- A framework's responsive variants are generated for **its own** utilities only, so `sm:<hand-written-class>` is a class that does not exist.
- A class-merging helper (`tailwind-merge` and kin) classifies a class it doesn't recognise by guesswork, and may drop it as a conflict, unless the project's own scale is registered with it.

Flag: a project class paired with an unmarked framework utility for one of its properties; a responsive variant on a project class; a project scale passed through a merge helper that does not know it.

## A Content Document Holds Words, Not Logic

Where a repo writes pages as documents (MDX, or any markup a build compiles into components), the document holds the words and places components; it decides nothing. A reader opens it to read prose, and a branch in it is a sentence they have to run in their head.

- **No conditional wording.** A document says the same thing to every reader; a page that seems to need a branch is two pages, or the varying part is a component.
- **A component is placed, not configured.** Its props are literal words, links, named figures and appearance values; its behaviour stays inside it ([Keep Shared Modules Presentation-Agnostic](#keep-shared-modules-presentation-agnostic)), and its doc comment says a document may place it.
- **A figure is named, never typed** ([No Magic Literals](../code-style/SKILL.md#no-magic-literals), [Reuse the Library's Types and Values](#reuse-the-librarys-types-and-values)): imported by name and rendered by a component.

```text
Good:  Orders over <Fact of={FREE_SHIPPING_THRESHOLD} /> ship free.
       <ShippingQuote heading="Price your order" href="/quote" />

Bad:   Orders over £50 ship free.
       {region === 'eu' ? <p>…</p> : <p>…</p>}
       <Chart data={orders.filter((o) => o.total > 50)} />
```

Where the repo's docs name a document format for its content pages, a large change to a page still written as code (a rewrite, a new section, a restructure) is the moment to move it to that format first; a small fix is just a fix. The repo's docs say which pages are content pages.

**Principle:** a concern per layer ([`design-rubric`](../../docs/design-rubric.md)).

**Enforcement:** review only, by `code-review`; the move is a suggestion, never a block.

**Source:** proposed here, with no external source.

## A Generic Helper Lives in the Utility Module

Arithmetic that is not the domain's own (raise an amount by a rate, take a percentage, round to the penny) lives in the package's utility module (for example its `money` module) and every domain module reuses it from there. Before writing a helper, look in that module first; if it is generic and missing, add it there, not beside the rule that needed it. A generic step written in a domain module, named or inline, is a second copy waiting to happen, and it hides which part of the function is the rule.

```ts
// Bad: a domain file redefines what money.ts already exports
// surcharge.ts
function withRate(amount: number, rate: number): number {
  return amount * (1 + rate);
}
export const surchargeOf = (base: number, rate: number, floor: number) =>
  Math.max(floor, withRate(base, rate) - base);

// Good: the utility does the arithmetic; the domain keeps its own floor
// money.ts
export function uplift(amount: number, rate: number): number {
  return amount * (1 + rate);
}
// surcharge.ts
export const surchargeOf = (base: number, rate: number, floor: number) =>
  Math.max(floor, uplift(base, rate) - base);
```

A helper that encodes a domain rule (a regulated floor, a scheme's rounding) is not generic: it stays with its rule, and calls the utility for the arithmetic inside it. This is [One Concern, One Module](../code-style/SKILL.md#one-concern-one-module) applied to helpers. [Reuse the Library's Types and Values](#reuse-the-librarys-types-and-values) asks whether another library already has it; this rule asks where in your own package it lives.

## An Index Is a Door

A directory's `index` module (`index.ts`, `index.mjs`) only re-exports. It names what the directory offers and defines nothing: every function, class and constant lives in a named module whose header states its question, so the door reads as the directory's contents list and a reader finds a definition by the name of its file.

```text
Good: shipping/index.ts    export {quoteShipping} from './quote.js';
      shipping/quote.ts    "what does it cost to ship this order?"

Bad:  shipping/index.ts    export {TIERS} from './tiers.js';
                           export function quoteShipping(order: Order) { … }
```

This holds for a directory with one concern too. The door is where its public surface is read, and an index that also holds the implementation hides that surface among the workings. A package's root `index` is the same rule.

**Enforcement:** review only, by `code-review`.

**Source:** proposed here, with no external source. It follows the common re-exporting ("barrel") module, so that the directories [One Concern, One Module](../code-style/SKILL.md#one-concern-one-module) makes stay readable.

## Separate Static from Varying

Metadata that doesn't change per variant (labels, slugs, descriptions) belongs in one constant keyed by the typed ID. Data that varies (figures, rates, thresholds) goes in a separate structure, also keyed by the same typed ID.

```ts
// Static: one place, never duplicated across periods
const INFO: Record<ItemId, ItemInfo>;

// Varying: one constant per period, data only
const DATA_2025: Record<ItemId, DataPoint[]>;
const DATA_2026: Record<ItemId, DataPoint[]>;
```

Adding a new period means adding one data constant — not copying labels, slugs, and descriptions.

## No Legacy Shapes

When migrating data from YAML, JSON, or CSV, design types for TypeScript consumers — don't mirror the source format. Ask: "How will call sites consume this?" not "What did the spreadsheet look like?"

- Arrays of objects with redundant keys → `Record` keyed by typed ID
- Wrapper objects with only one useful field → flatten
- String enums matching column headers → domain union types

## Flat over Nested

Prefer a typed `Record` over deeply nested wrapper objects unless nesting models real containment (e.g. a parent genuinely owns its children).

```ts
// Good: flat lookup, typed key
const items: Record<ItemId, Detail[]>;

// Avoid: unnecessary nesting
const data: { items: { id: string; details: ... }[] };
```

## Point the Check at the Build Under Test

code-style's [Tests and checks](../code-style/SKILL.md#tests-and-checks) govern the **expected value**. This one governs the other half: **what you actually measured.** A check can hold a perfectly good oracle and still be worthless because it was aimed at the wrong artefact — and that failure is quiet, because the wrong artefact answers in the right shape.

The tell is a check that reads its targets from data carrying an **absolute** address:

```ts
// Bad: sitemap <loc> entries are absolute production URLs, so this
// fetches the deployed site. Every response is a real 200 with real
// content — it simply is not the build you just changed.
for (const loc of locsFrom(sitemapXml)) {
  assertHeading(await fetch(loc));
}

// Good: take the PATH from the data and the ORIGIN from the build
// under test, so the check cannot silently retarget.
for (const loc of locsFrom(sitemapXml)) {
  const path = new URL(loc).pathname;
  assertHeading(await fetch(`${baseUrl}${path}`));
}
```

Same shape wherever a target is inherited rather than chosen: a config naming a production database, a fixture holding a deployed endpoint, a snapshot path resolved against the package root instead of the temp build. Split the two concerns — the **address of the thing** comes from the data, the **environment** comes from the harness — and keep the site's canonical constant for *comparison* only, never for fetching. The program-side half of that split, resolving where the code itself is running, is [Resolve the Environment Once](#resolve-the-environment-once).

**How you catch it without a rule: distrust a result that is too tidy.** A retargeted check reports the state of the untouched artefact, so it will happily tell you that nothing you just changed has changed. If a verification disagrees with an edit you know you made, suspect the target before the edit.

## Resolve the Environment Once

Where the program is running is state it is given, not something each module infers. A module that reads an ambient signal — `NODE_ENV`, a hosting platform's variable, a CI flag — to decide where it is, then branches on the answer, is guessing. Two such modules guess differently, and a context nobody listed (a local production build, CI, a scheduled job's checkout) falls between them. `NODE_ENV === 'production'` is the usual culprit: a framework sets it for every optimised build, so a check meant to ask "is this a real deployment?" fires on a developer's machine.

Name the shapes the environment can take, resolve the raw variables into one of them in a single owner module, and throw on any combination that fits none (the same fail-loud reading as [No Silent Default for a Domain-Selecting Input](../code-style/SKILL.md#no-silent-default-for-a-domain-selecting-input)). Every other module consumes the resolved value.

```ts
// Bad: each module infers its own answer from an ambient signal
if (process.env.NODE_ENV === 'production') requireAnalytics();

// Good: one owner resolves a closed set; the rest ask it
export const ENVIRONMENTS = {
  Dev: 'dev', Test: 'test', LocalBuild: 'local-build',
  Preview: 'preview', Production: 'production',
} as const;
export type EnvironmentKind =
  (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

// Called once with the raw variables — at startup, or at build time
// for a browser bundle. The table of valid combinations lives here;
// anything else throws.
export function resolveEnvironment(
  raw: Record<string, string | undefined>,
): EnvironmentKind { /* … */ }

export function isDeployed(kind: EnvironmentKind): boolean {
  return kind === ENVIRONMENTS.Preview || kind === ENVIRONMENTS.Production;
}

const kind = resolveEnvironment(process.env);  // the one read
if (isDeployed(kind)) requireAnalytics();
```

- **Make the resolver pure** — a function of the variables it is given — so a test covers every row of the table and every invalid combination.
- **Let a shape carry what it requires.** A deployed shape that must have a setting holds it, so resolving one proves the setting was present and a missing one fails at resolution, not at first use.
- **Resolve where the inputs are readable.** A browser bundle cannot read server-side variables; resolve at build time and inline the resolved name, rather than letting client code guess from what it can see.
- **How it runs is a shape too.** The dev server and the test runner are the `Dev` and `Test` members above, resolved from the same variables, so no module reads `NODE_ENV` to ask either.
- **Enforce the boundary.** A lint rule that bans raw environment reads outside the owner module keeps the next module from inferring again.

## Doubt the Harness Before the Product

When an automated check reports the application is broken, suspect the check first. These present as product defects and are not:

- **A controlled input needs the framework's own setter.** Assigning `input.value` and dispatching an `input` event does not move a React-controlled field: React holds its own value tracker and dedupes the event as "no change". Take the setter from the element prototype's property descriptor, call it against the node, then dispatch. The tell is a "failure" whose captured screen still shows the original value.
- **Scope the selector to the block you mean.** A pattern loose enough to match a value elsewhere on the page will report a working control as broken, and "the button" can resolve to one inside an overlay that happens to be open.
- **Forcing state open changes what you measure.** Expanding every collapsed section to read its text also expands the ones that were never on screen, inventing content. Query for what actually reaches the DOM — a class rather than a component name, since a hand-rolled copy carries the classes and not the name.
- **A synthetic `.click()` bypasses hit-testing.** Drive with real pointer coordinates when the thing under test is whether a click lands at all.
- **Element screenshots round their clip box**, so a sub-pixel "layout shift" can be an artefact of the capture, not the page.
- **A responsive preview that resizes a CONTAINER is a lie.** Breakpoints resolve against the viewport, so narrowing a wrapper leaves the wide variants applied. Use an iframe.

For anything visual and client-rendered, assert the **computed** value in a real browser. Confirming a rule was *served* proves nothing: a selector the vendor has moved still ships and matches nothing.

## A Fact Belongs to the Layer That Owns Its Meaning

A library that declares itself generic must not encode a fact that is only true inside one consumer's domain.

The tell is in the justification, not the value. If explaining why a number is what it is requires naming a scheme, an employer, a contract or a published instrument, then the number belongs to whatever layer owns that scheme — not to the general-purpose library underneath it.

```ts
// Bad, in a generic date library
/** Opening hours each weekday.
 *  9:00 to 17:30 (the flagship store's hours); the airport branch
 *  opens at 6:00 under its own lease. */
openingHours: TimeRange;
```

There are no universal opening hours. That value is one shop's terms, and the comment says so — which is the signal. The generic layer should take the hours from its caller; the domain layer above it holds the shop's hours and passes them in.

**The second tell is duplication across a dependency edge.** If the same named constant is defined in both a package and something that depends on it, ownership has never been decided — one of the two is a copy, and they will drift. Decide which layer owns it and delete the other.

Why this needs saying at all: "import shared data from the library that owns it" assumes ownership is obvious. It is not when TWO libraries could plausibly own a fact, and it says nothing about a constant sitting at the wrong layer rather than duplicated at the right one. Reviews run one repo at a time, so nobody is asked *"does this fact belong here, given what depends on this repo?"* unless the rule asks it.

## A Calculation Package Holds No Presentation

The sibling of the rule above, on the other axis. That one asks *which domain* a fact belongs to; this one asks *which layer* — and a package whose job is computation must not carry what a thing looks like.

```ts
// Bad, in a generic pricing library
/** Countries for the region picker. */
export const COUNTRIES = {
  fr: {label: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7'},
} as const;
```

The doc comment is the tell, and it is the loudest one available: *"for the region picker"* describes a control on a screen, from inside a package that has no screens. A calculation library cannot know what its caller renders — a CLI, a spreadsheet export and a web form all want a different answer, and only one of them wants an emoji.

**Check the consumers before recommending a move.** A display field that nothing reads is not misplaced, it is dead, and deleting beats relocating: it ships in every published bundle either way.

**Do not apply this reflexively to labels.** A library may legitimately own the one correct wording for a value it defines, so that consumers cannot invent competing names for the same thing — a shipping class, a subscription tier. The test is whether the string is *the thing's own name* or *chrome around it*. `'Tier 2'` is a name. A flag is chrome. Where it is genuinely a name, keep it and say so at the declaration, because the next reader will ask.

**Where this gets in is extraction.** Code lifted from an app into a package brings the app's view model with it, and the carve-out commit is busy proving the maths still passes. So the offending lines are usually as old as the package and have survived every review since — which is why a review must read a touched file whole rather than only its changed lines. Diff-scoped review cannot see a defect that predates the diff.

## One Value for Two Facts That Usually Agree

When two facts share a representation because they almost always hold the same value, nothing fails until the day they differ — and on that day every call site is already wrong.

The tell is a variable whose name answers one question while some of its readers are asking another. Look for a single field feeding two kinds of consumer: one that treats it as an identifier of a published thing, and one that treats it as a property of the present moment.

```ts
// A year that answers two questions at once
const CURRENT_YEAR = '2026-27';

loadPriceList(CURRENT_YEAR, country); // which list was published
computeVat(CURRENT_YEAR, country);    // which rates are in force now
```

Those coincide for as long as every party publishes on schedule. They separate the moment one runs late — and then the second call prices someone against rates nobody is using, silently, because the value is still a perfectly legal year.

**Splitting the value is not enough.** Renaming one of them to `priceListYear` fixes today's call sites and leaves the next author free to pass either, because both are still the same type. Two facts that must not be substituted for one another want either distinct types, or a single constructor that takes both and is the only way to obtain the pair.

**Then state the relationship as a rule.** If the two may legitimately diverge, say by how much and why, and assert it — a drift of one publishing cycle is a real-world state, a drift of two is a gap in your own data. An assertion that names the legitimate range turns a silent wrong number into a build failure with an explanation.

Why this is not covered by [No Magic Literals](../code-style/SKILL.md#no-magic-literals): the constant here is fine, correctly named for one of its two uses, and has a single obvious home. The defect is that two questions were asked of it, and neither the name nor the type records which one a given caller meant.

## Model the Domain Before Extending the Neighbour

When a change introduces a new domain type, or reshapes existing domain data, map the structure and settle the model BEFORE writing the code.

The failure it prevents is invisible from the inside. Reaching for the shape of the adjacent module — this one is a country-by-year lookup, so the new one becomes a country-by-year-by-category lookup — produces something that reads as consistent and is not modelling anything. It pattern-matches a neighbour, and the result looks right precisely because it matches.

Two questions, asked early, catch most of it:

- **What are the entities, and what does each one know?** A record whose identity lives only in its container's keys cannot describe itself to a caller.
- **Which existing type already holds this?** Extending a neighbour's shape is not the same as finding the type that owns the concept.
- **Do two identifier unions share values?** Where they overlap, one id compiles where the other is required and returns a plausible wrong answer. Give each domain its own distinct values, or a branded type.

Structural review AFTER the code is written finds these too — an anonymous record, an identifier collision — but finds them as rework rather than as design.

## Put the Accessor on the Entity That Has the Coordinates

For each exported function, ask whether some entity in the same package already carries **all** of its parameters as fields. If it does, the accessor belongs on that entity, and the free function is at best a low-level fallback for callers holding loose ids.

```ts
// Bad: the caller re-supplies what the entity already knows
const rate = shippingRateFor(order.country, order.year, order.service.tier);

// Good: navigation, not query
const rate = order.shippingRate;
```

Equivalently: the API reads as a QUERY — *fetch the record where country=X and tier=Y* — where the domain reading is NAVIGATION — *this order's shipping rate*. Query-shaped APIs over a domain model are a smell exactly when the entity exists.

**What does not follow**, so the rule is not over-applied: this is not a licence to store the relationship on both ends. Back-pointers do not follow, and they do not work where one side has no entity at all (its ids are a bare string union) or the two ends sit at different granularities. The rule is *put the accessor on the entity that has the coordinates*, not *add back-pointers*.

