---
name: cpp-style
description: >-
  C++ design and style rules, embedded-aware: naming, file layout, classes, error
  handling without exceptions, casts, const, fixed-width integers, macros, statics,
  tests, doc comments, and code that means the same on every processor and compiler
  it builds for. Use when writing or reviewing C++. A repo's own docs (linked from
  its CLAUDE.md) or its own `cpp-style` skill add its project's facts on top. NOT the mechanical rules clang-format and
  clang-tidy enforce.
user-invocable: false
paths: "**/*.cpp,**/*.h,**/*.hpp,**/*.cc,**/*.ino"
---

# C++ — Style Rules

## Intent

Govern C++ design and style judgment: what a linter can't see about how C++ is named, laid out and typed, and whether it has one meaning on every target.

## Applies-to

`.cpp`, `.h`, `.hpp`, `.cc` and `.ino` (declared in `paths:`). Preloaded as the rubric wherever C++ is written or reviewed; the [`code-review`](../../agents/code-review.md) agent loads it for those files.

## Owns-vs-defers

Owns the **design and style judgment** below. **Defers** the mechanical half to clang-format, clang-tidy and cppcheck (indent, braces, line length, include sorting): if one of them would catch it, it isn't this rubric's to restate. A repo states its project's facts (build flags, memory policy, targets, legacy code) in its own docs, linked from its `CLAUDE.md`, or in a `.claude/skills/cpp-style/SKILL.md` of its own, and those win where the two differ. Where both are silent, use judgment against the [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html); only the rules written here are cited as findings.

Several rules depend on how the project builds (exceptions, RTTI, the documentation warning). They are written "where the build …"; the repo's facts say which apply.

## Naming

| Element | Convention | Examples |
|---|---|---|
| Types / classes / structs / enums | `PascalCase` | `LineReader`, `IStream`, `ValveState` |
| Functions (free and methods) | `snake_case` | `read_line()`, `reader.poll()` |
| Variables | `snake_case` | `param_count` |
| Class data members | `snake_case_` (trailing underscore) | `client_`, `state_` |
| Struct data members | `snake_case` (no underscore) | `port`, `ip_addr` |
| Typed constants | `kPascalCase` | `kMaxBufferSize`, `kDefaultPort` |
| Macros | `UPPER_SNAKE_CASE` | `LINE_BUF_LEN`, `TRACE` |
| Enumerators | `PascalCase` | `Command::Start`, `Result::Ok` |
| Namespaces | `snake_case` | `net`, `sensor_io` |
| Files | `snake_case.cpp`, `snake_case.h` | `line_reader.cpp`, `valve_state.h` |


**Sentinel `Count` enumerator.** When an enum's values map to indices or need runtime bounds checking, add a terminal `Count` enumerator. It equals the number of valid values, so a bounds check needs no separate constant:

```cpp
enum class Command : uint8_t {
  Start,
  Stop,
  Unknown,
  Count  ///< Sentinel: number of valid Command values.
};

if (raw >= static_cast<uint8_t>(Command::Count)) { /* reject */ }
```

Use `Count` only on an enum backed by a fixed-width integer type whose values are contiguous from zero. Leave it off an enum switched over where the compiler warns on unhandled cases: the sentinel would suppress the warning.

## Layout of a source file

The C++ form of [Lay Out a Module Top-Down](../typescript/SKILL.md#lay-out-a-module-top-down); C++ adds the declarations, because a helper must be declared before its first use. [One Concern, One Module](../typescript/SKILL.md#one-concern-one-module) applies unchanged.

- **Types and constants first.** After the includes, a source file's own types (structs, enums, aliases) and constants come before any function, test files included; a helper's result type sits with them, not beside the helper.
- **Public code first, helpers after it.** A `.cpp` defines its public and externally visible functions first, in the order the header declares them, then its file-local (`static` or anonymous-namespace) helpers. A reader meets the entry points without scrolling past implementation detail.
- **Every file-local helper is declared near the top, with its doc comment on that declaration.** The declarations are what a reader sees first; the definitions after the public code are bare. A helper with no declaration, or defined above the code that uses it, is out of order.
- **The order holds for the whole file.** Bringing a file that breaks it into line is a change of its own, kept apart from a behaviour change so each reviews cleanly.
- **Include order:** the related header, then C system headers, the C++ standard library, other libraries, and the project's own.
- Close a namespace with a `// namespace name` comment.

## Headers

- Self-contained: each compiles on its own.
- `#pragma once`, not include guards.
- Include what you use rather than forward-declaring another file's types.

## Classes and structs

- `struct` for passive data; `class` for types with invariants. Data members are `private` in a class.
- All inheritance `public`. Use `override`; never restate `virtual` on an override.
- Mark single-argument constructors and conversion operators `explicit`.
- Declare or `= delete` copy and move explicitly. A type that owns a hardware resource (a pin, a peripheral, a connection) is non-copyable and non-movable.
- Do not call a virtual function from a constructor. Where construction can fail and exceptions are off, use a factory function or an `init()` method.
- Declaration order: `public`, `protected`, `private`; within each, types and aliases, constants, factory functions, constructors and assignment, destructor, other functions, data members.

## Error handling

- **Where the build disables exceptions** (`-fno-exceptions`), do not `throw`, `try` or `catch`, and do not call what reports failure by throwing (`std::stoi` on bad input).
- Signal failure with a return code, a status enum or a `bool`.
- Mark functions `noexcept` where it states intent (callbacks, destructors, moves).
- Return early on error rather than nesting.

## Type aliases

- `using`, not `typedef`; aliases are `PascalCase`.
- Alias a complex or repeated type, especially a template instantiation, in the narrowest scope that works (function, class-private, file, header).
- A public alias abstracts a type that may change, or names an intent the spelled-out type hides; not merely a shorter name. Never alias a fundamental type cosmetically (`using Int = int;`).

## RTTI

**Where the build disables RTTI** (`-fno-rtti`): no `dynamic_cast`, `typeid` or `<typeinfo>`. Use `static_cast` within a known hierarchy, and a tag enum or virtual dispatch where the type must be told at run time.

## Casting

- Never a C-style cast (`(int)x`): it silently combines `const_cast`, `static_cast` and `reinterpret_cast`.
- `static_cast` for value conversions and well-defined up- and downcasts.
- `reinterpret_cast` only for pointer and integer reinterpretation, such as register-mapped I/O, with a comment saying why it is safe.
- `const_cast` only to pass a legacy C API that lacks `const`; never to mutate a genuinely const object.
- Rely on an implicit conversion where it is safe and obvious; don't cast to silence a warning you should fix.

## Const correctness

- `const` wherever mutation is not intended: variables, parameters, return types, member functions.
- Input parameters: by value for small cheap types, otherwise by `const` reference; never by non-const reference.
- Output and in-out parameters: by non-const pointer, so the `&` at the call site shows the mutation.
- `constexpr` over `const` for values known at compile time.
- One `const` placement per file: east-const (`int const x`) or west-const (`const int x`), whichever the file already uses.

## Integer and bool types

- Fixed-width types from `<cstdint>` (`uint8_t`, `int16_t`, `uint32_t`). Bare `int`, `short` and `long` have widths that vary by platform, which register and protocol code can't afford.
- `size_t` for sizes and indices only at a standard-library interface; a fixed-width type otherwise.
- `float` and `double` explicitly: `float` where 32-bit precision suffices (sensor data, protocol fields), `double` where it doesn't, never `long double`.
- `bool` for true and false, not `int` or `uint8_t`; no `bool` bitfield wider than one bit.
- Compare explicitly rather than converting an integer to `bool` (`if (count != 0)`, not `if (count)`).

## Preprocessor macros

Prefer `constexpr` variables, `inline` functions and scoped enums. A macro is acceptable for conditional compilation, a platform or vendor macro (register maps, ISR wrappers, `PROGMEM`), and a debug or logging macro that uses `__FILE__`/`__LINE__` or compiles out of a release. Name it `UPPER_SNAKE_CASE` and `#undef` it where its scope ends.

## Static and global variables

- An object at file or global scope is trivially destructible, or `constexpr`/`constinit`.
- Global or static `const char*`, integers, fixed-size arrays of trivial types and `constexpr` objects are fine.
- A fixed lookup table (command dispatch, say) may be a function-local `static const std::map`: initialised once on first call, never modified. Whether the target can afford its allocation is the repo's memory policy.
- `constexpr` for compile-time globals; `constinit` where initialisation must be dynamic but happens once.

## Local variables

- Narrowest scope, declared at first use and initialised at declaration.
- A variable used only inside an `if`, `while` or `for` is declared in that statement.

## Type deduction (`auto`)

- Prefer explicit types: on a constrained target the exact width matters.
- `auto` where the type is obvious from the right-hand side, or for iterators and structured bindings where the spelled-out type is noise.
- Never `auto` for a numeric type, and no `decltype(auto)`.

## Switch statements

- A `switch` on a non-enum value has a `default`.
- Mark intentional fall-through with `[[fallthrough]];`.
- Prefer `enum class`, so an unhandled case warns.
- Over an enum with a `Count` sentinel, either omit `Count` and add a `default`, or handle `Count` explicitly; never let it fall through silently.

## General

- No `using namespace`. `nullptr`, not `NULL`. Prefix `++i` unless the old value is needed.
- Keep a function to the length limit in [`python-style` § Functions](../python-style/SKILL.md#functions), or the repo's clang-tidy `readability-function-size` where it sets one.

## Tests

**Naming.** `test_<subject>_should_<expected>`, as in [`python-style` § Tests](../python-style/SKILL.md#tests), naming the requirement, not the mechanism: `test_record_should_have_no_padding`, not `test_record_size_should_equal_sum_of_fields`. Every name carries `_should_`; a name that describes only the setup (`test_reader_half_line`) says nothing about the outcome.

**Documentation.** Every test function has a `///` comment: one line each for setup, action and expected outcome, then why the test exists (the requirement or regression it guards). It does not restate the name:

```cpp
/// Feed the reader one complete "START" line.
/// Poll until done.
/// The callback should fire once with Command::Start.
/// Guards the contract that a whole line yields exactly one command.
void test_complete_line_should_fire_callback_once(void) {
```

**Layout as a contract.** Where a type's layout is a contract (a wire format, a register map, an on-disk record), assert that invariant, such as `sizeof` equal to the sum of the fields where no padding is intended, rather than each field's size. It catches the drift that breaks the contract.

## Documentation comments

Doxygen `///` comments on the public API. **Where the build enables `-Wdocumentation`**, a malformed doc comment is a compile error.

**Required in headers:** a `/// @file` banner; a `///` block before each class, struct, enum and type alias; `@param` for each parameter and `@return` for a non-void return on public functions; `///<` after each enumerator; on a `constexpr` constant, what it controls, where it is enforced, and what happens past the limit; `///<` on a member whose purpose the name doesn't give.

**Optional:** in `.cpp` files and tests, `//` comments on non-obvious logic (protocol parsing, state machines). A literal that stands for something gets a `kPascalCase` `constexpr` name, not a comment ([No Magic Literals](../typescript/SKILL.md#no-magic-literals)). Private members need no Doxygen; a file-local helper's doc, where it has one, sits on its declaration ([Layout of a source file](#layout-of-a-source-file)).

```cpp
/// @brief Short summary when @param or @return follows.
/// @param stream Byte source to read from.
/// @param limit  Most bytes to consume this call.
/// @return true if a complete line was handled.
bool poll(IStream* stream, uint16_t limit);
```

- `///`, not `/** */`. `/// @brief` only when `@param`, `@return` or `@note` follows; a bare `///` for a one-liner.
- `///<` trailing comments for enumerators and members where a block above each would be noise.
- Don't repeat what the type says: not "@param len The length", but what it measures.

## Portability and undefined behaviour

Code whose result could differ between processors or compilers. Code built for more than one target (firmware and its host-run tests, say) must have one defined meaning on each.

- **Headers describe portable behaviour.** A public name or doc comment does not name a processor, compiler or runtime. If behaviour must differ by target, the difference lives in a source file or the build configuration.
- **Do not depend on what one compiler or processor does with undefined behaviour.** Common cases: signed overflow, an out-of-range float-to-integer conversion, a shift past the type's width, out-of-bounds or null access, an unaligned or aliasing-violating access, and reading an uninitialised value. Write code whose result the language defines on every target.
- **Arithmetic that can outgrow its type gets a deliberate choice:** a wider type; an unsigned type where wrapping is the intent, such as a difference of free-running timer counts; or a check that reports the problem.
- **A conversion that can fail returns a status** (a `bool`, with the result through an output pointer) when a wrong value would reach a protocol, a setpoint or hardware. The one alternative is a clamp that is the specified behaviour and whose name says so; never an unspecified one ([the same failure on the way out](../typescript/SKILL.md#the-same-failure-on-the-way-out)).
- **Matching legacy code does not license copying its undefined behaviour.** Legacy code that relies on it stays as it is, each case recorded in the repo's own docs (the file, the construct, the class of undefined behaviour); new code does not recreate it.
- **Behaviour that depends on the architecture** (the cases above, integer widths, struct layout and alignment) **is checked where it runs:** a test on the target, and a host test that exercises the boundary value. A sanitizer on host-run fuzzing (UBSan, made fatal) is a second net, not a substitute.
