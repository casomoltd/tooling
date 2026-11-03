# Quality gates

Every consuming repo is gated locally by git hooks, so code is
deployment-ready by the time it reaches the remote. GitHub Actions re-runs
`check` on push and publishes on a version tag: the local hooks are the gate,
CI is the backstop. Wiring the hooks into a repo is the README's
[Husky hooks](../README.md#husky-hooks) section.

## The hooks

- **pre-commit**: `npm run check`, the repo's full health gate.
- **commit-msg**: commitlint (house rules and the AI-attribution ban), then
  [`check-listed-files`](lint.md#the-list).
- **pre-push**: `npm run check`, then `check:routes` where the repo defines
  it, then the version, tag and linear-history guards.

## `check` owns the build

A repo whose build fails is not healthy, and any assertion that reads build
output has to run after the build in the same script. So `build` belongs in
`check` and appears nowhere else: declaring it in the pre-push gate as well
would give it two owners and build twice.

The exception is `check:routes`, which reads the build outside `check`. It
starts a server, which belongs to a push rather than to every commit, so the
pre-push hook runs it after `check`.

## What every repo's `check` must contain

`check` is a hand-written, ordered chain, because the repos are heterogeneous
and some orderings are load-bearing. Its **composition is enforced**, not
remembered: run `check-gates` as its first step.

```json
"check": "check-gates && npm run lint && npm run typecheck && ..."
```

It fails if a required gate is missing, if one is defined but never run (a
dead gate), or if an exception outlives the problem it was written for.
Required: `lint`, `typecheck`, `test`, `knip`, `jscpd`, `lint:md`, `spell`,
`build`.

A repo opts out by declaring a **reason**. A blank one fails, so an opt-out is
never silent, and every exception is printed on each run:

```json
"casomo": {
  "gates": { "test": "content site — no suite yet" }
}
```

## Wire a missing gate, never rewrite it

If a house gate is missing from a repo, **wire the shared one**; if the shared
one cannot run there, fix this package. Never write a local equivalent: a local
copy drifts from the shared rules, and the length limits are what it loses
first. `check-hooks` reports whether a repo is gated, testing it by behaviour
rather than by the hook file existing. A repo whose toolchain is not npm still
wires the shared `commit-msg` gate, through the
[dev-only npm layer](../README.md#a-repo-whose-toolchain-is-not-npm).

## Fix issues, don't disable checks

When a check fails, **fix what it found**. Never weaken the check to make the
failure go away: no `strict: false`, `skipLibCheck: true` or
`noImplicitAny: false` in a `tsconfig`, no blanket `# type: ignore` or
`# noqa`, no `@ts-ignore`, no `eslint-disable` without a scope and a reason. A
weakened check passes while the defect it guarded is still there, and every
later change builds on that false green.

A deviation the code genuinely needs is declared where it is enforced, with
its reason beside it:

- a lint rule a repo turns off for some paths:
  [Where a deviation lives](lint.md#where-a-deviation-lives);
- lint debt from the day a rule came in: [the list](lint.md#the-list);
- a required gate a repo cannot run yet: the opt-out with a reason, above.

The same rule applies below the config, to a type relaxed to quiet the
compiler: `typescript`'s
[Don't Weaken a Type to Silence the Compiler](../skills/typescript/SKILL.md#dont-weaken-a-type-to-silence-the-compiler).
The plugin's guard hook refuses the `tsconfig` and bare `# type: ignore` cases
([What the guards enforce](../hooks/README.md#what-the-guards-enforce)); the
rest is held in review.

## Out of scope

- The lint rules and their limits: [lint.md](lint.md).
- Commit-message shape and the commit workflow: the
  [`commit`](../skills/commit/SKILL.md) skill.
- Bumping, tagging and pushing: the
  [`release-version`](../skills/release-version/SKILL.md) skill.
