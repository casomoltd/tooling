---
name: code-style
description: >-
  The house code standard: the rules every language shares — module and
  function shape, named literals, data across a boundary, failing loud,
  comments, tests and checks, what the program tells people, and
  stopgaps. Each language standard (typescript, python-style, cpp-style)
  applies on top of it with its own forms
user-invocable: false
---

# Code Style

## Intent

Govern the design rules every language shares, stated once, so a language standard holds only what its language adds.

## Applies-to

All code, in any language, written or reviewed. Preloaded with the language's own standard wherever code is written or reviewed (the [`code-review`](../../agents/code-review.md) and [`design-xray`](../../agents/design-xray.md) agents).

## Owns-vs-defers

Owns the rules more than one language shares, and the review duties that hold for all code. A rule belongs here once a second language needs it, written so it reads true in each, with examples as shapes rather than one language's syntax. **Defers** each language's own forms and its single-language rules to that language's standard, which wins where the two differ; the mechanical rules to each language's linter; and the prose of docs to [`docs-style`](../docs-style/SKILL.md). A repo's own facts, in its docs or a repo-held style skill, win over both.

**Principle:** [design-rubric](../../docs/design-rubric.md). The rule headings are the citation keys the review agents and docs use, so a heading is not renamed.

## Modules and functions

### One Concern, One Module

A module answers one question, and that cuts both ways.

- **Split** a module that answers several: IO, domain logic and presentation in one file, or a function that fetches and parses and formats.
- **Merge** modules that answer the same one. Before adding a file, search the package's exports and module headers for the concept, and extend the module that already answers it.

```text
Good: shipping/tiers      "what does each shipping tier allow?"
Bad:  free_threshold, max_weight, and a rate table in quote_basis
      one value or function each, and the same question
```

The second failure is invisible from inside each file: every module is small and tidy, and the size limits reward it. The cost lands on the reader, who has to know several names to find one concept, and on the next rule of the same kind, which takes a third file because two set the pattern. A value also drifts into whichever module first read it, so within its layer, place it by the question it answers.

**The test:** give each module a one-line header stating its question. A header that needs "and" to join two subjects is two modules, and two headers stating one question are one module. Read the exports as well as the header, since a header can be reworded to pass.

**Keep them apart** only for one of these reasons, named in the module's header:

- they sit in different layers or have different owners, and a merge never crosses that edge;
- the file mirrors one external document, one transcription per instrument. The transcriptions stay apart, and the module that reads them is the one to merge;
- merging would form an import cycle or point a dependency the wrong way;
- one is public and the other package-private;
- the merged module passes the file limit with sections that share nothing. That makes it a directory, whose modules still answer the one question.

A different source is not a reason: cite each rule beside its data. Nor is a different change cadence, which is where this rule departs from the single-responsibility principle cited under Source.

**Enforcement:** review only, by [`code-review`](../../agents/code-review.md) and [`design-xray`](../../agents/design-xray.md). No lint can tell that two questions are the same.

**Source:** proposed here, with no external source; it carries out [design rubric](../../docs/design-rubric.md) Q7. The split takes after the single-responsibility principle (Robert C. Martin, *Clean Architecture*, 2017, ch. 7). The merge is this rule's own: read as one reason to change, that principle can argue against it.

### Lay Out a Module Top-Down

Below the imports, order every module the same way, so a reader meets its surface before its workings:

1. Types and classes.
2. Constants, public ones first.
3. Functions, public ones first, then the private helpers.

Within a class, public members come before private ones. Two exceptions, both because something must exist before it is read: a constant another constant reads comes first whatever its visibility, and a language that needs a declaration before first use declares its helpers above the public functions. Keep a private constant in the constants block even when one function alone reads it: a reader scanning for a module's constants finds it there without reading every function.

### Keep a Function to One Screen

The house limits, blank lines and comments not counted: a function runs to 50 lines and takes 4 parameters, and a file runs to 400 lines. They mirror [`eslint/house-rules.mjs`](../../eslint/house-rules.mjs), which holds the source of each, explained in [`docs/lint.md`](../../docs/lint.md). Where a language's lint enforces them, its standard says where; where lint does not run on a file, or has no such rule, this rubric holds the same limits.

A function past the limit is doing more than one thing: give each thing a name and a doc comment, and let the function assemble them. A parameter list past it is a value object passed in pieces ([Pass Value Objects, Not Loose Fields](#pass-value-objects-not-loose-fields)).

```text
Good: checkout(cart) returns total_of(cart), tax_on(cart), delivery_for(cart),
      each a named, documented function
Bad:  checkout(cart) holds all three inline, each headed by a comment
```

## Names and literals

### No Magic Literals

A literal needs a name when its meaning is not visible where it is used. That covers a literal that repeats (a path, a storage key, a query parameter, an event name, a host) and equally one used once that stands for something defined elsewhere: a rule's threshold, a code from another system's document, a position in another structure. Where a library owns the value, import its constant; otherwise give it a named constant, exported where it is shared, and use it at every site. Where a value is derived from another, derive it rather than typing it twice. Keep the literal as the constant's value, so a reader can still check it against its source; where it is transcribed from a published source, cite it per [Pin Transcribed Reference Data to a Cited Fixture](#pin-transcribed-reference-data-to-a-cited-fixture).

```text
Good: RETIREMENT_AGE = 60, defined once;  if age >= RETIREMENT_AGE
Bad:  if age >= 60    (the reader must look up what 60 is)
```

### Find Files From the Program's Own Location

A program finds the files it works with from where it is, never from a machine path. Take its own directory once, resolving any symlink it was called through, name it, and derive every root from it by the layout around it: `HERE` in a shell script, `Path(__file__).resolve().parent` in Python, `import.meta.dirname` in a Node module. Where a root sits outside the layout the program can see, read it from an environment variable, with the derived path as its default. Why a machine path fails is in [Naming a place outside the unit](../../docs/skill-agent-schema.md#naming-a-place-outside-the-unit), which applies the same rule to a skill's prose.

```text
Good: HERE=$(dirname "$(realpath "${BASH_SOURCE[0]}")")
      repo=$(dirname "$HERE");  DATA_ROOT="${DATA_ROOT:-$repo/../datasets}"
Bad:  DATA_ROOT="$HOME/dev/acme/datasets"    (wrong once acme is renamed)
```

**Source:** proposed here, with no external source.

## Data across a boundary

### Pass Value Objects, Not Loose Fields

A domain concept crosses a boundary as a typed value, not as bare strings, numbers or untyped maps. When a function needs several fields a value object already carries, accept the **object**, not its unpacked fields. Unpacking a rich type into loose parameters at the call boundary throws away the type checker's help, lets callers pass mismatched or stale values, and bloats every call site. If a sibling function already takes the object, the new one should too, so their interfaces stay parallel.

A list of parallel `min`/`max` (or other obviously paired) values **is** a value object not yet named. Collapse each pair into a small range type and pass one argument per span, even if that type must be defined locally because no library owns it yet. "The fields are flat, so flat parameters are fine" is not a defence: the shape is the unit, and a six-number parameter list hides three.

```text
Bad:  forecast(temp_min, temp_max, humidity_min, humidity_max, wind_min, wind_max)
Good: forecast(temp: Range, humidity: Range, wind: Range)
Good: price_schema(product)    not  price_schema(product.name, product.sku, ...)
```

Flag any function whose parameters duplicate the fields of a domain type already in scope at every call site.

### Variants over Mode Flags

When a unit varies along a small fixed axis of behaviour, model each variant explicitly; don't thread a `mode` string or flag through the body. A mode flag pushes a runtime branch into the body, duplicates logic across branches, and leaks an untyped contract callers must decode. Prefer distinct named variants (a function, class or type per case, or a config keyed by a typed constant) so callers select intent **by name, not by a magic string**. When variants share structure, keep the shared part in one place and let each variant carry only its difference.

```text
Bad:  label(id, mode)  with  if mode == "long" ... else ...
Good: short_label(id)  and  long_label(id)
```

### Once Dispatched, Don't Re-Ask the Type

Choosing distinct variants is only half of polymorphism; the other half is that an implementation must not re-interrogate the tag it was chosen by. An implementation that accepts every case, then tests a `kind` or `type` field to reach its own data, has rebuilt the branch the variants were meant to remove. Type each implementation to its own case, so its data is known without a check; the tag selects the implementation (the caller choosing it, or a lookup keyed by the tag), and is never a branch inside one.

Ordinary conditionals are fine; this is a **type-tag** conditional that redoes a dispatch already made. Flag: a tag test **inside** a variant's method; a variant that accepts every case and immediately narrows; a tag field on the *implementation* rather than on the data. A linter can flag a tag test the types prove redundant, and the language standard names the rule; none catches "this *should* have been polymorphic", which stays a review call.

### A Library Takes Only What Its Rule Needs

A library's public functions and types ask for the values its own rule needs, in its own domain's terms, and nothing else. The test: could a second consumer, with a different model of the same domain, call it without importing anything of the first's?

Two failures:

- **A consumer's concept leaks down.** A rate library that names a shop's carts, baskets or customers has learned the caller's model, and the next caller with a different model cannot use it. The rule needs a weight and a distance, so its interface asks for exactly those, and the consumer translates.
- **An option for a caller that doesn't exist.** An extra parameter or optional field added "so a caller could pass this" is interface with no user: a branch to test, a conflict to refuse, a doc to keep true. Add the option when its first caller arrives, not before.

```text
Bad:  shipping_cost(order, [optional zones])  the shop's model, and an option nobody passes
Good: shipping_cost(weight_kg, distance_km)   the rule's own inputs, in its own terms
```

Why this is not covered by [Pass Value Objects, Not Loose Fields](#pass-value-objects-not-loose-fields): that rule says pass the object rather than its fields; this one says which object a library may ask for, and a consumer's object is the wrong one.

### A Domain Rule Lives in the Library, on Every Path

A rule the domain owns (a regulatory minimum, a rounding convention, a region-specific adjustment) belongs in the library that owns the data, applied wherever that library produces the affected value, never re-implemented or patched at a call site. When a consumer appears to need the rule, the fix is upstream, and it must cover **every** path the library exposes for that value, not one. The trap is consolidating a shared transform into a single path (a table build, one accessor) and dropping it from another: a second path that still takes the raw value silently skips the rule, and every consumer that reaches the value that way is quietly wrong.

```text
Bad:  build_scale(region) applies the minimum; regionalise(raw_base, region) does not
Good: both apply it; the transform is idempotent, so it composes
```

So a single site for the rule is safe only if every consumer flows through it. Before removing a transform from a path because "another path already does it", confirm no caller reaches the value the first way; otherwise keep it on both and guard the pair with [Guard Cross-Path Invariants with a Test](#guard-cross-path-invariants-with-a-test).

## Failing loud

### No Silent Default for a Domain-Selecting Input

A parameter that selects **which** answer you get (a locale, region, country, period, currency, price list) must be **required**. A default returns a *plausible-but-wrong* value when a caller forgets it: no error, no type failure, no failing test, so the mistake ships, and every future call site can make it too. Make the input required so an omission fails to compile or to type-check; where it cannot be (it is derived at runtime), **raise** rather than fall back. A lint rule can ban a default on a selector-typed parameter, but whether a default hides a wrong answer is a review call.

```text
Bad:  price_list(year, region = <default "gb">)  forget it and a French user gets GB prices
Good: price_list(year, region)                    omitting it is an error
```

The distinction is *which* against *how*: a default is fine for a **tuning** parameter that changes how a result is computed or presented (page size, timeout, precision, sort order), never for one that changes **which** result you get. The test: would two different values return different data, not just different formatting or performance? If yes, it selects the domain; require it.

One convenience default is uniquely dangerous because it scales: a single default region can produce the wrong answer in a report, a batch job and an API handler, three incarnations of one bug, because each call site independently forgot the argument the API let it omit. This pairs with [A Domain Rule Lives in the Library, on Every Path](#a-domain-rule-lives-in-the-library-on-every-path): a required selector means no path can silently fall back to the wrong region's data.

#### The same failure on the way out

A **defaulted result** hides a wrong answer exactly as well as a defaulted parameter: an empty list where data was expected, a zero, a silently skipped element, a sentinel that collides with a valid result. No error, no type failure, no failing test: the same three absences, reached from the other end.

```text
Bad:  a missing catalogue entry becomes a shorter list; the caller cannot tell
      "this market does not carry the item" from "someone deleted the row"
Good: absence is declared per item ("not carried, because ..."), so a forgotten
      entry is an error rather than an item that quietly vanishes
```

Skipping on a declaration is fine; skipping on a missing key is not. The test is whether the code can tell a deliberate absence from a mistake; if it cannot, neither can the caller. A conversion that can fail reports the failure (an exception, a status, an empty optional the caller must check) rather than returning an unspecified clamp or a stand-in.

Flag: an optional parameter, a fallback or a first-element pick that selects locale, region, country, period, currency or price list; a function that returns data for a "default" locale when the caller passed none; and a function that answers a domain question with an empty or truncated result where the honest answer is to fail loud.

### Don't Swallow Exceptions

An empty handler discards the error and hides real failures. Raise at the operation that cannot do its job; catch at one boundary that decides the policy (skip, retry, abort); and there, report the error before recovering or rethrowing. Never leave a handler empty.

```text
Good: catch the parse error, report it with its context, then return the fallback
Bad:  catch everything and return the fallback; the failure is now invisible
```

An empty handler is acceptable only for an expected, benign case (an optional cache file that is absent, say), and then it carries a comment saying why.

## Comments

### A Comment Carries the Why, Never the When or the Who

Flag a comment that dates itself (`(15 Aug)`, `since the March pass`), names a person (`Sam spotted this`), or narrates the change history of the code it sits in ("the first pass put this below, the second moved it back"). Version control already holds the date, the author and the sequence, and a hand-written copy of them starts drifting the moment anyone touches the file. Keep the reasoning, drop the provenance: *what breaks if this changes* survives a rewrite; *when we decided it* does not.

Route the rest by kind: a **decision** belongs in the decision log, a **reusable rule** in the relevant standard (so it is enforced once, not re-argued at every site that obeys it), and only a fact **local to this code** stays as a comment. Naming a source **artefact** for a constant (`the ratio the design brief used`) is provenance for the number and is fine; naming a person or a date is not.

### The Why Is the Why Now

Flag a comment that argues its case against what the code used to be: "the old importer wrote this twice", "it was the only one of its kind among nine siblings", "this replaced a lookup table that went stale". The reader needs the standing reason the code is shaped this way; they have never seen the version being argued against and cannot check the claim. Rewrite to the live consequence (*the bounds are the rule: an end date cannot precede its start date*), which is shorter, checkable against the code in front of them, and survives the next rewrite.

This is [`docs-style`](../docs-style/SKILL.md) § State current truth, not history, applied to comments, and it is harder to see here: a comparison to the old design **feels** like rationale, which is why it survives review. If the history is worth keeping, the commit message is where it belongs.

## Tests and checks

### Name a Test for the Requirement It Proves

Name a test `test_<subject>_should_<expected>`, stating the requirement it proves, not the mechanism it exercises: `test_record_should_have_no_padding`, not `test_record_size_should_equal_sum_of_fields`. Every name carries `_should_`, so the list of test names reads as a specification of the behaviour; a name that describes only the setup (`test_reader_half_line`) says nothing about the outcome. A test runner with its own sentence form states the same requirement in that form.

### Guard Cross-Path Invariants with a Test

When two code paths must produce the same result (a value derived two ways, a fast path against a reference path, a consumer's computation against the library's), assert **path A equals path B**, not just each path against its own fixture. A fixture pins one path; only the equivalence test catches a refactor that changes one and leaves the other, which is exactly how a "consolidate into one site" change silently diverges the two.

```text
Weak:   scale_for(region).points[0] == EXPECTED            one path only
Strong: regionalise(raw_base, region) == scale_for(region).points[0]
```

Where the result is externally knowable, add an **oracle** assertion to the concrete figure with its source cited **inline at the assertion**. A test module is a verification document, so the reference belongs at the exact line it verifies, not in a header. That turns the test from "the code agrees with itself" into "the code agrees with the world".

### Pin Transcribed Reference Data to a Cited Fixture

When you transcribe an external table into code (price lists, shipping rates, regulatory limits), commit a fixture that mirrors the authoritative table (one row per value, the **source cited**) and assert the code against it. A code-against-code check (a value equals a recomputation, or a hardcoded expected value) proves internal consistency, not correctness: a whole table transcribed on a wrong factor is perfectly consistent and still wrong, and only a fixture tied to the published source catches a bad transcription.

```text
Weak:   rate_for("a5") == 42000          transcribed from the same place as the code
Strong: for each row of scales.csv (source cited):  rate_for(row.key) == row.value
```

**Cite the primary source at the data, not only in the fixture.** The constant or table in the code carries its source in a doc comment where the values live (the issuing body, the document and its URL), so a reader re-verifying a figure finds the origin at the number. A transcribed table of statutory figures with no source in the code is a finding even when a fixture exists.

A **uniform offset across an entire table** (every value high by the same fraction) is the signature of a wrong transform: a mis-applied uplift, a rounding, a unit slip. Treat it as a data bug and re-check the factor against the source, not as noise.

### Don't Pin a Computation to Its Own Output

A test for a **computed model** (a projection, an amortisation, a forecast, any multi-step arithmetic) needs at least one assertion the implementation could not have produced. Two habits fail this, and both look like thorough tests:

- **Recorded output.** Run the code and write the answer down as the expected value. It now asserts the number hasn't *moved*; it cannot assert the number is *right*, and it will pin a wrong model for years.
- **A re-spelled implementation.** Compute the expected value in the test with the same formula the code uses. Two spellings of one model agree by construction; the test catches drift between them and nothing else.

Add an **independent derivation**, one that reaches the figure by a different route:

```text
Weak:   project(input).total == 23123.67                     whatever the loop produced
Strong: project(input).total == slice * ((1 + r)^n - 1) / r  the closed form of the same series
```

Other independent routes: a **worked example from the source document** (cited inline), a hand-computed boundary case, or a **property** the model must satisfy however it is implemented (a figure that must not move when an unrelated input changes; an identity two outputs must obey). Properties are often the cheapest real oracle, because they need no external figure.

**Choose the fixture so the two routes agree exactly**, then say why in a comment. A closed form and an iterative loop diverge on partial periods, unit conventions or rounding for legitimate reasons; picking a span where they must agree turns a tolerance into an exact claim, and the comment stops a later reader loosening it.

**A constant re-typed in a test is deliberate; cite it.** Importing the implementation's own constant makes the test agree with whatever that constant is changed to, which is the one thing it exists to guard. Re-type the literal and put its source at the assertion.

**The strongest oracle predates the code.** A fixture whose expected values were derived by the same reasoning as the implementation agrees with whatever the implementation is changed to; one worked by hand from the source document *before* the code was written cannot. Read the source rather than recalling it ([An Assertion Must Be Able to Fail](#an-assertion-must-be-able-to-fail)).

Recorded output is still worth keeping as a **regression pin**; it is just not verification. Where a suite is pins-only, **label it as such in the module header** and name what would actually settle correctness (a real statement, a published worked example, a regulator's own calculator). An unlabelled pin reads as proof and quietly retires the question.

### An Assertion Must Be Able to Fail

Flag a new or edited test whose expectation checks only a sign or a direction (greater than zero, truthy, not empty) where a magnitude is available: such a test passes while the value under it is wrong by any amount in the right direction. Flag too an expected value that reads as though it came from **memory rather than the cited source**: a wrong oracle costs the same debugging time as a real defect and buys nothing.

### Watch a Guard Fail Before Trusting It

Flag a newly added check, gate or invariant with no evidence it engages: a pin proved failing against the pre-fix code, a canary, a deliberately broken input. Three ways they pass vacuously:

- a check that runs against a build artefact **it does not own**, so it asserts against whatever was last built;
- an invariant placed where the pipeline never executes it;
- a name or hook borrowed from a dependency that a major version has moved, which still ships and matches nothing.

**Break it on purpose and watch it fail, or it is untested.**

## What the program tells people

### A Stand-In Value Never Reaches a Claim

Flag a fallback (a default, a clamp) whose stand-in value also reaches prose, a label, a log line read as fact, or an axis tick. A default is fine for arithmetic (a layout has to start *somewhere*) and wrong the moment the same value is printed under a word that asserts what it is, because the reader cannot tell a real value from a placeholder. The numeric form is a clamp that answers an out-of-range question with its own boundary, so several distinct inputs report one figure and a monotonic series stops being monotonic. The fix is to give the fact a real source, or to stop asking a question there is no answer for; **never to relabel the stand-in**.

### Count the Population the Question Asks About

Flag an instrumented event, metric or property where the population counted is not the population implied: users the system *detected* reported as evidence of demand, when only users who *asked* are that; a control measuring what to build sharing a series with one measuring what converts; or a rename that silently continues a series whose meaning changed. Flag too a key **nothing can emit**: a dead key reads later as a series that broke rather than one that was never wired, so it is worse than no key at all.

### Copy Changes With the Behaviour

When a change alters what something does, flag any user-facing text still describing what it did: a caption, a tooltip, a label, an empty state, a help entry, a command's help text, an error message. These read as prose and survive review because they are not code, so nothing fails when they go stale, and the reader is told one thing by the program and another by the words beside it. The copy is part of the behaviour: it changes in the same commit, not in a later pass.

## Stopgaps

### Link a Stopgap to Its Tracking Task

A stopgap (a note that a figure is about to change, a workaround for an upstream gap, a value shown until a source updates) carries a comment linking the **issue or task that tracks its removal**, not a bare `temporary` or `TODO`. The link keeps the stopgap and its retirement connected: the tracking item's definition of done names the code to delete, and a reader who finds the comment sees why it is still here and when it goes. A `temporary` with no pointer is how a stopgap quietly becomes permanent.

```text
Bad:  TODO: remove once the new scale lands
Good: Stopgap until the library models the next rate table; retire with <tracking task URL>
      (its definition of done includes deleting this note).
```

#### Only where the tracker is visible to the repo's readers

This rule stops at the repository boundary. In a **public** repo (one published to a registry, or open on a public forge) the tracking link must be one every reader can open: that repo's own public issue tracker. A link into anything the reader cannot reach is useless to them, and it discloses that the item exists, what it is called, and what the team is working on.

Where no public issue exists, name the retirement **condition** instead. That is the more durable half anyway: a tracking item can be closed, moved or renamed, whereas "when the publisher issues the successor" stays true.

```text
Bad, in a public repo:  Stopgap until the new scale lands; retire with <internal tracker URL>
Good, in a public repo: Stopgap until the publisher issues the successor table; delete
                        this note and read the figures from the library.
Also good:              Stopgap until the upstream fix lands; retire with #412.
```

The same applies to prose in a public repo (a README, a docs page, a manifest) and to internal identifiers generally: tracker ids, private repo names, internal hostnames, people's names. Keep those in the private system where the work is planned. A rule published in a public repo must not name the internal systems its authors happen to use, or it stops being a generic standard and starts being a disclosure.

#### A tracking link is a comment, never a value

A tracking link lives in a comment or a doc, never in a constant, a string or an error message. The program never reads it, so as a value it only adds code to follow, and ships in every bundle, log and message. It is not a [magic literal](#no-magic-literals) that wants a name: the program never branches on it. A source URL in a cited fixture's `source` column is different: there the citation is the data the fixture pins ([Pin Transcribed Reference Data to a Cited Fixture](#pin-transcribed-reference-data-to-a-cited-fixture)).

```text
Bad:  MODELLING_TASK = "<tracking task URL>", carried in the error raised for an unmodelled year
Good: a comment beside the check: "Lift this once the allowance is modelled: <tracking task URL>";
      the error says only "<year> is over"
```
