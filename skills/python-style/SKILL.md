---
name: python-style
description: >-
  Python code generation style rules — Google style with
  Casomo preferences (types over dicts, EAFP, uv, pyright)
user-invocable: false
paths: "**/*.py"
---

# Python Code Generation — Style Rules

## Intent

Govern Python code generation — the design/style judgment for how Python is
written, so output isn't naive and procedural.

## Applies-to

`**/*.py` (declared in `paths:`). Preloaded as the rubric wherever Python is
written or reviewed — e.g. the `code-review` and `design-xray` agents load it for
`.py`.

## Owns-vs-defers

Owns the **design & style judgment** — class design, types over dicts, EAFP,
naming, module API, docstrings. **Defers** the mechanical half to `ruff` /
`pyright` (line length, import order, `D100`/`D103`, `RUF022`, `E722`, annotation
syntax): if a linter would catch it, it isn't this rubric's to restate.

The rules below are self-contained — apply them directly. They take the
[Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
as the baseline (assume its conventions wherever this file is silent),
but what's written here is what's enforced; don't rely on fetching the
guide at runtime.

## Design

Default output tends to be naive and procedural. Reach for these first —
they are the corrections most often needed. Apply them before writing,
not after review.

**When planning, present the class hierarchy.** A design plan should name
the types and how they relate (what subclasses what, what implements
which `Protocol`, which collections wrap which elements) — not just a
list of functions. Weight that hierarchy toward the `collections.abc`
ABCs: if a domain concept is a group of things, say which ABC it is
(`Mapping`/`Set`/`Sequence`/`Collection`) and why, in the plan, before
any code is written.

- **Separation of concerns.** Keep IO, domain logic, and presentation in
  separate units. A function that fetches *and* parses *and* formats is
  three responsibilities — split them.

- **Depend on abstractions, not implementations (ports & adapters).**
  Define the interface the logic needs (a `Protocol` / type alias) in its
  own module; keep the concrete adapter (HTTP client, DB driver) in
  another. High-level code imports the interface and receives the adapter
  by injection; it never imports the concrete module just to name a type.
  Don't mix the abstraction and its implementation in one module. A port
  with a **single operation** is a `Callable` type alias, not a one-method
  `Protocol`; reserve `Protocol` for ports with several methods or state.

  ```python
  # ports.py — a single-operation port is just a Callable alias
  type Fetch = Callable[[str], str]

  # a multi-method port earns a Protocol
  class Store(Protocol):
      def get(self, key: str) -> bytes: ...
      def put(self, key: str, value: bytes) -> None: ...

  # client.py — the adapter (imports ports, not vice versa)
  def http_get(url: str) -> str: ...   # satisfies Fetch structurally
  ```

- **Polymorphism over type codes.** An object carrying a `kind`/`type`
  field that callers `if`/`match` on is a missing subtype. Give each
  variant a class behind a shared `Protocol`; let one small factory pick
  the type, so call sites never ask "which kind are you?".

  ```python
  # No — callers switch on a type code
  if shape.kind == "circle":
      area = pi * shape.r**2
  elif shape.kind == "square":
      area = shape.side**2

  # Yes — each shape owns its behaviour
  class Shape(Protocol):
      def area(self) -> float: ...
  ```

- **Tell, don't ask (delegation).** An object should act on its own data
  — render, serialize, validate itself — rather than callers reaching in
  for its fields. A collection renderer delegates:
  `"\n".join(str(item) for item in items)`, not one big function that
  picks each item apart. Use `__str__` for an object's natural
  human/text form (so it formats via `f"{obj}"` and logs cleanly); use
  named methods for alternate formats (e.g. `as_html()`). Keep the
  dataclass-generated `__repr__` for debugging — don't conflate the two.

- **Put behaviour where its data lives.** Before adding an operation, ask
  which type owns the data it needs, and put it there (`order.total()`,
  `report.render()`, `record.key`). Two failure modes to catch: a
  **category error** — hanging an op on a type that doesn't hold its data
  (a formatting method on a bare id, a pricing method on a timestamp); and
  an **aggregate** over many items, which belongs to the collection or a
  free function, not to a single element (`merge(parts)`, not
  `part.merge()`).

- **Factory classmethods.** Alternate constructors belong on the class as
  `@classmethod` (`Order.from_row(...)`, `Report.load(path)`), not free
  `build_order()` functions. Bind load/save and class constants
  (`ClassVar`) to the class that owns the data, not scattered module
  helpers.

- **Service factories are `make_x()` functions.** Building a *collaborator*
  — a client that needs a credential, a service that loads config, a cache
  that resolves a directory — is a free `make_x()` factory that
  encapsulates the env/config/credential wiring and returns the ready
  object to be injected. This is distinct from an alternate *constructor*
  of a value (`X.from_row`), which stays a classmethod. Don't name it
  `configure_x` — that implies hidden, stateful side effects.

- **Value objects, not primitives.** Don't pass bare `str`/`dict` between
  modules for a domain concept. Wrap it (`NewType`, a frozen dataclass, a
  model) so the type carries meaning and can grow behaviour.

- **Identity vs. data.** A value object owns its *identity* and behaviour,
  not the heavy artifact it identifies — that lives in a store keyed by the
  identity (content-addressing: the key *is* the content, so a stale entry
  can't exist). When identity must persist across runs, derive it from a
  **stable content hash** (`sha256(payload).hexdigest()[:16]`), never Python
  `__hash__`: `hash()` of a `str`/`bytes` is randomised per process
  (`PYTHONHASHSEED`), so it can't be persisted or compared across runs.

- **Model collections on `collections.abc`.** When a domain concept is a
  *group* of things, make it a class that subclasses the right ABC rather
  than passing a bare `list`/`dict` around. Pick the ABC by the access
  pattern you actually use, not the storage you happen to keep:
  lookup-by-key → `Mapping`; dedup + membership → `Set`/`Collection`;
  ordered + indexed → `Sequence`. The ABC gives you the full interface
  (`keys`/`values`/`get`/`__contains__`, set algebra, …) from a few
  methods, and lets the type own domain operations (e.g. `unseen`,
  `since`). Don't reach for `Mapping` just because the elements have a
  key — only if something genuinely looks them up by it; if you only
  iterate and dedupe, that's a `Collection`/`Set`.

  ```python
  # ids ARE looked up (set-difference then recover the object) → Mapping
  class Records(Mapping[RecordId, Record]):
      def __init__(self, items=()): self._by_id = {r.id: r for r in items}
      def __getitem__(self, k): return self._by_id[k]
      def __iter__(self): return iter(self._by_id)
      def __len__(self): return len(self._by_id)
      def unseen(self, seen) -> list[Record]:
          return [self[k] for k in self if k not in seen]
  ```

- **EAFP — raise at the operation, handle at the boundary.** An operation
  that can't do its job raises; a single resilience boundary catches and
  decides policy (skip, retry, abort). Never return a sentinel that
  collides with a valid result.

  ```python
  # No — sentinel hides the failure (an empty list also means "no items")
  def parse(text: str) -> list[Item]:
      try:
          return real_parse(text)
      except ParseError:
          return []

  # Yes — raise; the caller's boundary decides what to do
  def parse(text: str) -> list[Item]:
      return real_parse(text)  # propagates ParseError
  ```

- **Dependency injection over patching.** Pass collaborators (a fetcher, a
  clock, a path, a client) as parameters with sensible defaults; tests
  inject fakes. Needing `monkeypatch.setattr(module, ...)` means the seam
  is missing — add the parameter instead.

- **Framework-first.** Before hand-rolling serialization, validation,
  parsing, or config handling, use the library that does it. A
  hand-written `to_dict`/`from_dict` pair is usually a model class you
  haven't reached for yet.

- **Simplest representation; don't over-build (YAGNI).** Model data with the
  plainest type that serves the access you actually have, and add structure
  only when a concrete need forces it — not speculatively. Two tells: a
  bespoke layer that re-implements what a standard library or built-in
  already does (that's *Framework-first* — don't re-solve a solved problem),
  and an abstraction wrapping data a `list`/`dict`/dataclass already models.
  Prefer **net deletion**; don't add a type whose only job is to host one
  method.

- **Keep a policy in one place.** The two halves of one policy — encode and
  decode, serialise and parse, open and close, a format and its parser — are
  a single decision and belong together (one class, one module, one
  construction site). Split them and they drift onto different assumptions:
  one half quietly relies on something the other no longer guarantees. Define
  the policy once and route both directions through it.

- **A domain rule holds on every path.** A rule the domain owns — a statutory
  floor, a rounding, a region-specific adjustment — is applied wherever the code
  produces the affected value, not re-implemented at a call site. It lives in
  the type/module that owns the data, on **every** path that emits the value.
  Consolidating it into one path (a table build, one accessor) is safe only if
  every consumer flows through that path; a second path taking the raw value
  silently drops the rule. Before removing a transform from a path because
  "another already does it," confirm no caller reaches the value the other way —
  else keep it on both (an idempotent transform composes) and guard the pair
  with an equivalence test (see Tests).

- **No hardcoded config.** Domain values — URLs, hosts, addresses,
  limits, paths — live once in a config module and are imported, never
  re-typed as literals scattered across modules. If a value appears in
  two places, derive one from the other (`USER_AGENT = f"…{BASE_URL}"`),
  don't repeat it.

## Types over dicts

Prefer `NamedTuple` or `@dataclass` over plain dicts for structured data.
Use dicts only for genuinely dynamic key-value mappings (e.g. JSON payloads
you're passing through without inspecting).

```python
# Yes
from typing import NamedTuple

class Point(NamedTuple):
    x: int
    y: int

# Yes
from dataclasses import dataclass

@dataclass(frozen=True)
class Point:
    x: int
    y: int

# No
point = {"x": 1, "y": 2}
```

Use `NamedTuple` only for a plain immutable, read-only record with no methods.
Once the type grows methods or validation, prefer `@dataclass(frozen=True)`: it
stays immutable while giving behaviour a clear home. Use a mutable `@dataclass`
only when you genuinely need to reassign fields.

## Naming

- Modules/packages: `lower_with_under`
- Classes: `CapWords`
- Functions/methods: `lower_with_under()`
- Constants: `CAPS_WITH_UNDER`
- Internal/private: prefix with single `_`
- Never use double underscore `__` for name mangling
- Be descriptive — avoid abbreviations except well-known ones (`id`, `url`, `db`)

## Imports

- `import x` for packages/modules; `from x import y` for specific symbols
- **Within a package, import siblings relatively** (`from . import x`,
  `from .models import Y`, `from ..config import Z`); reserve absolute
  imports for stdlib and third-party. External consumers (tests, scripts,
  other packages) import the package absolutely. Rationale: the package is
  relocatable, and internal vs external dependencies read at a glance.
  Neither ruff nor pyright can *require* relative imports (ruff's TID251
  resolves relative imports to their absolute path and bans both), so
  enforce it with a small AST guard test that flags absolute self-imports
  inside the package.
- **Imports at module level** — never nest imports inside functions or
  methods. Two exceptions only: `if __name__ == "__main__":` blocks, and a
  **heavy or optional third-party dependency** imported lazily inside the
  factory/method that uses it, so commands that never touch it don't pay its
  import cost at startup (e.g. a CLI whose `--help` or validation path
  shouldn't import a heavy cloud or ML SDK it never calls). Enforce the rule
  globally with `ruff` `PLC0415`, and
  grant a **commented per-file-ignore** to the one module that does the lazy
  import — keep that ignore list short and justified so the deviation stays
  visible.
- Group in order: stdlib, third-party, local — sorted lexicographically within groups
- Separate groups with a blank line

## Module API

- Every module declares `__all__` — the names it exports. Anything not in
  `__all__` is internal to the module. This holds for **every** module — leaf
  modules and `__init__.py` alike — even where neighbouring files predate the
  rule; a missing `__all__` is a gap to close, not a convention to match.
- `__all__` and the `_` prefix agree: public names have no leading
  underscore and appear in `__all__`; internal helpers, classes, and
  constants start with `_` and are omitted. (`logger` is the conventional
  exception — module-level, never exported.)
- A package's `__init__.py` re-exports the package's public API and
  declares its own `__all__`, so callers import from the package, not its
  submodules.
- Keep every `__all__` sorted (ruff `RUF022` enforces the sort). `RUF022` only
  orders an `__all__` that already exists — it does not require its presence, so
  declaring one is an authoring/review responsibility; ruff `F822` flags names
  listed in `__all__` that aren't defined.

## Type annotations

- Annotate all public function signatures
- Use `X | None` not `Optional[X]`
- Use built-in generics: `list[str]`, `dict[str, int]`, `tuple[int, ...]`
- Use `collections.abc` for abstract types: `Sequence`, `Mapping`, `Iterable`
- Don't annotate `self`, `cls`, or `__init__` return
- Default values with annotations: `arg: str = "default"`

## Docstrings

Google-style docstrings with `"""triple double quotes"""`.

```python
def load_records(path: Path) -> list[Record]:
    """Load records from a CSV file.

    Args:
        path: Path to the CSV file.

    Returns:
        List of Record objects, one per row.

    Raises:
        FileNotFoundError: If the file does not exist.
    """
```

- First line: imperative summary ending with a period, under 80 chars.
- `Args:`, `Returns:`, `Raises:` sections with hanging indent.
- Omit docstring on trivially obvious private helpers.

## Functions

- Keep functions under ~40 lines. Break up longer ones.
- Never use mutable default arguments. Use `None` then initialise inside.
- Use `operator` module over trivial lambdas.
- Lambda only for one-liners under ~60 chars.

## Ordering — public before private

- **At module scope, all public names come before private (`_`-prefixed)
  ones.** Lead with the public API (constants, classes, functions);
  private helpers and private constants go below. Forward references
  resolve at call time, so a public function may call a private helper
  defined further down — that's fine and expected.
- **Within a class, public methods before private (`_`) methods.**
- One exception to "definitions first": a private type referenced in
  another definition's *annotation* must appear before that use
  (annotations evaluate at definition time).
- The `main()` entry point and the `if __name__ == "__main__":` guard
  stay at the bottom.

## Error handling

- Prefer EAFP (try/except) over LBYL (check-then-act): attempt the operation
  and handle the exception, rather than testing preconditions up front.
- Use built-in exceptions: `ValueError`, `TypeError`, `FileNotFoundError`, etc.
- Validate in the constructor (`__post_init__` for dataclasses) and raise, so
  an object cannot exist in an invalid state — don't return sentinel values.
- Use `raise ... from None` to suppress an irrelevant chained exception.
- Never bare `except:`. Never catch generic `Exception` unless re-raising.
- Minimise code in `try` blocks.
- Use `with` statements for files, sockets, and any resource that needs cleanup.

```python
# Yes (EAFP)
try:
    value = mapping[key]
except KeyError:
    value = default

# No (LBYL)
if key in mapping:
    value = mapping[key]
else:
    value = default
```

## Strings

- Use f-strings for formatting.
- Consistent quote style within a file (prefer `"double quotes"`).

## Logging

- A module obtains its logger canonically:
  `logger = logging.getLogger(__name__)` at module scope. Never pass a
  hardcoded name — a logger name is infrastructure identity, and a magic
  string there is invisible to ruff and pyright: misspell it or rename the
  package and the module silently detaches from the configured hierarchy.
- Handlers and levels are configured once, in a single setup function, on
  the package root logger — `logging.getLogger(__package__)` — so every
  module logger propagates to it. No other module touches handlers.
- Use `%`-style placeholders in log calls, not f-strings.
- `print` is for program *output* — the data the user asked for. Status,
  progress, and diagnostics go through the module logger, never `print`.

## Line length

88 characters max. Exceptions: long imports, URLs.

## Comprehensions

- Use for simple cases only.
- No chained `for` clauses — use a regular loop instead.

## Main guard

Every script must have:

```python
if __name__ == "__main__":
    main()
```

No top-level execution besides imports and definitions.

## Tests

- Name a test as the requirement it proves, not a label:
  `test_<subject>_should_<expected>` — e.g.
  `test_press_self_destruct_should_go_bang`. The list of test names
  should read like a specification of the behaviour.
- Every test has a docstring: the steps it performs, and **why** it
  exists (the requirement or regression it guards).
- One behaviour per test; arrange → act → assert.
- Guard a **cross-path invariant** with an equivalence test, not just a
  per-path fixture: when two paths must agree (a value derived two ways, a
  fast path against a reference), assert `path_a == path_b`, so a refactor
  that changes one and not the other fails. Where the result is externally
  knowable, assert the concrete figure with its **source cited inline at the
  assertion** — a test module is a verification document, so the reference
  sits at the exact line it verifies, proving correctness against the world,
  not just internal consistency.
- **Pin transcribed reference data to a cited fixture.** When you transcribe
  an external table into code — pay scales, tax thresholds, statutory rates —
  commit a fixture mirroring the authoritative table (one row per value, the
  source cited) and assert the code against it. A code-vs-code check (a value
  equals a recomputation, or a hardcoded expected) proves consistency, not
  correctness: a whole table transcribed on a wrong factor is internally
  consistent and still wrong — only a fixture tied to the published source
  catches it. And a **uniform offset across a whole table** (every value off
  by the same fraction) is the signature of a wrong transform — a mis-applied
  uplift, a rounding, a unit slip — not noise.

```python
def test_press_self_destruct_should_go_bang():
    """Pressing self-destruct detonates the reactor.

    Arm the reactor, press self-destruct, and assert it detonates.
    Guards the safety contract that an armed reactor must respond to the
    self-destruct command (regression: PR #42 swallowed the signal).
    """
    reactor = Reactor(armed=True)
    reactor.press_self_destruct()
    assert reactor.detonated
```

## Project-specific

- Manage the environment with uv: `uv sync`, `uv run …` (the venv lives at
  `.venv/`). Don't call `pip` directly or edit `requirements*.txt`.
- Lint with `ruff` (configured in `pyproject.toml`); all code must pass
  `ruff check` with zero errors before committing.
- Type-check with pyright (strict mode); all code must pass `pyright` with
  zero errors before committing.
