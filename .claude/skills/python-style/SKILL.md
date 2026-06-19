---
name: python-style
description: >-
  Python code generation style rules — Google style with
  Casomo preferences (types over dicts, EAFP, uv, pyright)
user-invocable: false
paths: "**/*.py"
---

# Python Code Generation — Style Rules

Follow the [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
with the project-specific preferences below.

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
  Don't mix the abstraction and its implementation in one module.

  ```python
  # interfaces.py — the port
  class Fetcher(Protocol):
      def __call__(self, url: str) -> str: ...

  # client.py — the adapter (imports interfaces, not vice versa)
  def http_get(url: str) -> str: ...
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

- **Factory classmethods.** Alternate constructors belong on the class as
  `@classmethod` (`Order.from_row(...)`, `Report.load(path)`), not free
  `build_order()` functions. Bind load/save and class constants
  (`ClassVar`) to the class that owns the data, not scattered module
  helpers.

- **Value objects, not primitives.** Don't pass bare `str`/`dict` between
  modules for a domain concept. Wrap it (`NewType`, a frozen dataclass, a
  model) so the type carries meaning and can grow behaviour.

- **Model collections on `collections.abc`.** When a domain concept is a
  *group* of things, make it a class that subclasses the right ABC rather
  than passing a bare `list`/`dict` around. Pick the ABC by the access
  pattern you actually use, not the storage you happen to keep:
  lookup-by-key → `Mapping`; dedup + membership → `Set`/`Collection`;
  ordered + indexed → `Sequence`. The ABC gives you the full interface
  (`keys`/`values`/`get`/`__contains__`, set algebra, …) from a few
  methods, and lets the type own domain operations (`new_since`,
  `unseen`). Don't reach for `Mapping` just because the elements have a
  key — only if something genuinely looks them up by it; if you only
  iterate and dedupe, that's a `Collection`/`Set`.

  ```python
  # ids ARE looked up (set-difference then recover the object) → Mapping
  class Publications(Mapping[PublicationId, Publication]):
      def __init__(self, items=()): self._by_id = {p.id: p for p in items}
      def __getitem__(self, k): return self._by_id[k]
      def __iter__(self): return iter(self._by_id)
      def __len__(self): return len(self._by_id)
      def new_since(self, seen) -> list[Publication]:
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
- **All imports at module level** — never nest imports inside functions or methods.
  The only exception is `if __name__ == "__main__":` blocks.
- Group in order: stdlib, third-party, local — sorted lexicographically within groups
- Separate groups with a blank line

## Module API

- Every module declares `__all__` — the names it exports. Anything not in
  `__all__` is internal to the module.
- `__all__` and the `_` prefix agree: public names have no leading
  underscore and appear in `__all__`; internal helpers, classes, and
  constants start with `_` and are omitted. (`logger` is the conventional
  exception — module-level, never exported.)
- A package's `__init__.py` re-exports the package's public API and
  declares its own `__all__`, so callers import from the package, not its
  submodules.
- Keep every `__all__` sorted (ruff `RUF022` enforces this).

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
- For logging: use `%`-style placeholders, not f-strings.

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
