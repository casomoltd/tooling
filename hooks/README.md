# Claude Code hooks (`casomoltd` plugin)

Generic **PreToolUse hooks** that enforce git/npm/type-safety discipline the
same way across every repo the plugin is enabled in. They run *before* a tool
executes and can confirm, hard-block, or wave it through. All rules are generic
(no repo-specific names), so they ship in the public plugin.

## File map

| File | Role |
|---|---|
| `hooks.json` | Registration — which guard runs on which tool event (the harness reads this) |
| `guard-bash.mts` | Bash-command rule registry (git, npm and uv discipline) |
| `guard-edit.mts` | Edit/Write rule registry (don't weaken type-checking) |
| `lib/run.mts` | The engine — `evaluate()` (registry → verdict) + `runGuard()` (stdin → decision, the rule's reason plus its `detail`); **asks** when the input can't be read, allows what matches nothing |
| `lib/rule.mts` | The rule model — `Rule`, `ToolInput`, `VERDICTS` |
| `lib/command-shapes.mjs` | The commit form, matched whole so the commit prompt can read its repo and message file, and the plain-path class that keeps them exact |
| `lib/shapes.d.mts` | Their declaration |
| `lib/commit-detail.mts` | What a commit is about to record — repo, staged files, message — for its confirmation prompt |
| `lib/contract.mts` | The harness wire types (**vendored**) + `preToolUseDecision()` constructor |
| `test-cases.mts` | Each guard's cases: a tool input and the verdict it should get |
| `wrapped-cases.mts` | The Bash guard's cases for a command wrapped or quoted: behind a prefix, in a subshell or `bash -c`, or with its flag quoted |
| `test.mts` | The cases run against the registries, plus end-to-end runs and the ask-on-unreadable checks |
| `commit-detail.test.mts` | The commit prompt's reading of the commit form, and its text |
| `tsconfig.json` | Strict `tsc --noEmit` config for the type gate |

## What the guards enforce

| Rule | Verdict | |
|---|---|---|
| `git commit` | **ask** | deliberate, not automatic; a commit in [the commit form](../docs/commit.md#the-command) also shows what it will record |
| `git push` | **ask** | never automatic — confirm; names the release push, `--atomic --follow-tags` |
| `npm version patch\|minor` / `uv version --bump patch\|minor` | **ask** | the release tail, not a mid-work step |
| force-push / `reset --hard` / `rebase -i` / `tag -d` / `filter-branch` | **deny** | rewrites/loses history |
| `--no-verify` on any git command, or a commit's `-n` | **deny** | skips the repo's checks and message gate; the person runs it themselves if it's really needed |
| `npm version major` / `uv version --bump major` | **deny** | needs explicit human approval |
| global install (`npm i -g` / `--global`) | **deny** | project-local only |
| `tsconfig` strict-weakening (`strict:false`, `skipLibCheck:true`, …) | **deny** | fix code, not the config |
| bare `# type: ignore` (Python) | **deny** | scope it: `# type: ignore[code]` |

`ask` forces a user confirmation dialog; `deny` hard-blocks. Each rule
searches the whole command text, so a command is caught however it is wrapped:
behind `sudo` or an env prefix, in a subshell, a substitution or `bash -c`,
and with options between `git` and its verb (`git -C <dir> push`). A mention
inside an argument is caught too, which errs towards caution.

The bulk of these are **command/shell intent** — git/npm safety that no linter
or commit hook can see (it isn't a file, and the commit hasn't happened yet).
That's the guards' sweet spot. They deliberately do **not** duplicate rules an
authoritative gate already owns:

- AI-attribution in commit messages → **commitlint** `no-ai-attribution`
  (`commit-msg` hook).
- `@ts-ignore` / `@ts-nocheck` → **eslint** `@typescript-eslint/ban-ts-comment`
  (in `npm run check`).

A Claude rule earns its place only when nothing authoritative already catches
it, and a rule is removed from here only once its real home enforces it (no
coverage gap). The two content rules that remain — `tsconfig` strict-weakening
(tsc *passes* once weakened) and bare `# type: ignore` (until a consumer's
ruff config adds `PGH003`) — stay only because nothing else guards them yet.

(Drafted commit *messages* are deliberately not guarded here either: the
`commit` skill drafts the message to a file, runs the repo's own `commit-msg`
git hook over it, and only then commits with `git commit -F` — same file, same
gate, just before the commit instead of during it. The whole process, step by
step, is [Commits](../docs/commit.md).)

## Failure handling

A hook is advisory for commands it understands:

- **Matched a rule** → emit its verdict (`deny` / `ask`).
- **Matched nothing** (e.g. `git status`) → **allow silently**. The common path;
  a benign command shouldn't nag.
- **Can't read the input at all** — unparseable JSON, or no `tool_input` →
  **`ask`** (confirm manually), plus a stderr line. When the guard genuinely
  can't make sense of its input, the human decides rather than the guard
  proceeding blind. It's `ask`, not hard `deny`, on purpose: these wrap *every*
  Bash/Edit call, so a guard that hard-denied on a hiccup would brick the
  workspace — including the commands to fix or disable it.

These hooks are *a* layer, not *the* gate. Two cases sit outside their reach: a
hook that can't even *start* (Node below the floor, a parse error before our
code runs) is fail-open at the harness; and a present-but-odd payload that
matches no rule is simply allowed (we don't hunt for missing fields). The
repo-boundary git hooks (`commit-msg`/`pre-push`) remain the authoritative,
actor-independent enforcement.

## How this relates to `settings.json` and skill `allowed-tools`

Three independent layers gate a tool call; they compose, they don't duplicate.
Pick the layer by what the rule needs to *know*:

| Layer | Where | Good for | Can't do |
|---|---|---|---|
| **Permission lists** (`allow`/`ask`/`deny`) | `settings.json` | *Static, unconditional* command patterns, e.g. `Bash(gh pr merge:*)` | Inspect message/file *content*; disambiguate flags robustly |
| **PreToolUse hooks** (these `RULES`) | the plugin (`hooks/`) | *Conditional/logic* guards — content inspection, flag disambiguation, a confirm-vs-block decision | — |
| **Skill `allowed-tools`** | a skill's `SKILL.md` frontmatter | Scoping *which tools a skill may call while it's active* (an allow-list for that skill's run) | Gate tools outside that skill |

So `settings.json` **is** the right home for blanket denials, and the workspace
keeps `Bash(gh pr merge …)` / `Bash(gh repo delete …)` there — those need no
logic. These hooks exist for the rules a static pattern **can't** express:

- *Content* — "an edit that sets `strict:false` in a tsconfig" — permissions
  match tool+argument patterns, not file content.
- *Flag logic* — `git push --force` → deny but plain `git push` → ask, while
  letting `--force-with-lease` through; `-g` anywhere on an `npm i`. Globs handle
  this brittly; a parser doesn't.
- *Portability* — hooks ride with the plugin (versioned, distributed to every
  repo that enables it), whereas a `settings.json` deny-list is per config-root
  and would have to be copied into each.

Nothing in `settings.json` needs to change because of these hooks — the layers
are additive (a call is blocked if *either* a hook or a permission rule denies
it).

## Design decisions

### TypeScript, run via native type-stripping (`.mts`, no build)

The guards are authored in TypeScript so the harness contract is **typed** and
drift is caught at author time (see vendoring below). But:

- **Why `.mts`, not `.ts`** — this package isn't `"type": "module"`, so Node
  would treat a bare `.ts` as CommonJS and break our ESM (`import.meta.url`,
  `import`). `.mts` is *always* ESM, like `.mjs`.
- **Why native strip, not a compile step** — a hook `command` runs as a
  subprocess under the *consumer's* Node, and a plugin installs by git-clone (no
  `npm install`, so no hook to run a build). Node ≥ 22.18 / ≥ 24 executes `.mts`
  by stripping types with **no flag and no build**. So we ship the source as-is.
  - Floor consequence: on older Node the hook exits non-zero (non-blocking), so
    tools still run — just unguarded (**fail open**). Documented in the parent
    README.
  - Constraint: only *erasable* syntax (no `enum`/`namespace`/decorators) — we
    use `as const` objects and string-literal unions, so this is satisfied.
- **Stripping ≠ checking.** Running `.mts` *erases* types; it validates nothing.
  The real enforcement is the `tsc --noEmit` gate in `npm run check` — that's
  what fails the build when a rule or the contract is mis-typed.

### Vendored contract types

**Vendoring** = copying a dependency's declarations into this repo instead of
importing it as a package, so we own the code and carry no dependency — at the
cost of re-syncing by hand if upstream changes.

`lib/contract.mts` vendors the ~4 hook types that define the stdin/stdout wire
contract (`PreToolUseHookInput`, `PreToolUseHookSpecificOutput`,
`HookPermissionDecision`, plus the `PreToolUseHookOutput` wrapper), transcribed
from the Claude Agent SDK — `@anthropic-ai/claude-agent-sdk@0.3.187`
(`sdk.d.ts`); see also <https://code.claude.com/docs/en/hooks>. We vendor rather
than `import type` from the SDK to:

- keep this **public config repo dependency-free** (no ~3.6 MB SDK pulled in just
  for types), and
- avoid `skipLibCheck` — tsc deep-checking the SDK's own `.d.ts` would need it,
  but `skipLibCheck:true` is exactly what our own `guard-edit` rule denies.

Trade-off — **drift**: the `tsc` gate checks our code against this *snapshot*,
so it can't, by construction, notice the upstream contract moving. That's
acceptable because we read only `tool_input`'s `command`, `file_path`,
`content` and `new_string`, and write only `hookSpecificOutput`'s
`permissionDecision` and `permissionDecisionReason`, and the contract evolves
*additively*, so the realistic risk is low. When bumping the plugin or if hooks
misbehave, **re-sync** the declarations in `contract.mts` from the current
`sdk.d.ts` and bump the cited version (the file header records the source); the
live `/hooks` smoke test is the reality-check that the wire contract still
behaves.

## Testing & adding rules

`npm run typecheck` type-checks `hooks/tsconfig.json`; `npm run test` runs
`hooks/test.mts` and `hooks/commit-detail.test.mts` (`node:test`); both run in
`npm run check`. The types
prove the output *shape*; the tests prove the rule *logic* plus the
ask-on-unreadable behaviour.

To add a rule: append a `Rule` object (`{id, verdict, reason, matches,
detail?}`) to the relevant registry — the `Rule` type enforces its shape, and
a case naming a rule id that doesn't exist fails to compile — and add its
cases to `test-cases.mts`.
