# Casomo Workspace

This is a multi-repo workspace for Casomo Ltd, not a single project.
Each subdirectory is an independent git repo with its own CLAUDE.md
for project-specific instructions. See `casomo.code-workspace` for
the active projects.

## Tool Usage

- Use `Read` instead of `cat`, `head`, or `tail`
- Use `Glob` instead of `ls` or `find`
- Use `Grep` instead of `grep` or `rg`
- Only use Bash for commands that genuinely need shell execution

## Code Conventions (all repos)

### Fix Issues, Don't Disable Checks

If TypeScript/ESLint/pyright finds an issue, fix the code — don't
silence the tool. Never weaken strict checks (`strict: false`,
`skipLibCheck: true`, `noImplicitAny: false`, blanket `type: ignore`)
to make errors disappear.

### Framework-First Development

Always leverage frameworks and libraries instead of custom
solutions. Use what the framework provides — don't reinvent
components, utilities, or patterns that already exist in your
chosen libraries.

Never hardcode financial constants (tax thresholds, salary
figures, pension rates, NI limits) in consumer repos — import
them from the library that owns the data.

### Assertions

Use `invariant()` for preconditions, not `if/throw`.

### Documentation: Explain WHY, Not WHAT

Comments and docstrings should explain reasoning and context, not
restate what the code already shows.

### Typed Identifiers

Use `as const` objects for domain keys and derive the union
type — never pass bare `string` between modules:
`const THINGS = { A: 'a', B: 'b' } as const` then
`type ThingId = (typeof THINGS)[keyof typeof THINGS]`.

### Code Style

- **Line length:** 88 characters maximum
- **File naming:** `.ts` for logic, `.tsx` for React components
- **Package installs:** Always project-local (`npm i` / `npm i -D`),
  never global

## Before Committing

Run the repo's checks before committing. The command depends on
the toolchain:

- **npm repos** (`package.json`): `npm run check` — each repo's
  `check` script runs whatever validation that project needs.
- **Python/uv repos** (`pyproject.toml`, no `package.json`, e.g.
  `infra`): there is no `npm run check`; run the strict suite
  directly — `uv run ruff check && uv run ruff format --check &&
  uv run pyright && uv run pytest`.

## Versioning

Bump versions with the repo's own tooling — never edit the
version field manually or create tags by hand. **Never bump
major** (`npm version major` / `uv version --bump major`) —
major bumps require explicit user approval.

- **npm repos:** `npm version patch` / `npm version minor`
  updates `package.json`, commits, and creates an annotated tag
  atomically.
- **Python/uv repos:** `uv version --bump patch` (or `minor`)
  only edits `pyproject.toml` + `uv.lock` — it does **not**
  commit or tag. Stage those files, commit `v<version>`, then
  create an **annotated** tag (`git tag -a v<version> -m
  v<version>`). A lightweight tag won't reach the remote via
  `git push --follow-tags`.

## Publishing

The three product libraries — **`paye-calc`, `nhs-pay`,
`design-tokens`** — publish to the **public npm registry**
(`registry.npmjs.org`) via GitHub Actions, authed by the
`NPM_PUBLISH_TOKEN` org secret. Public installs need no token or
`.npmrc` — consumers just `npm i @casomoltd/<pkg>`.

- **Trigger: publish on push to `main`** (uniform across the three).
  Safe because the pre-push `check-version` hook rejects a push to main
  unless the version bumped vs `origin/main`, so every main push is a
  new version. Flow: `npm version patch` → `git push --follow-tags`
  (the push publishes). Wait for the workflow before `npm i` in
  consumers (`gh run list -L 1`).

**`tooling` is not published.** It's shared config + CLI, consumed as a
**git dependency** from its public repo
(`github:casomoltd/tooling#semver:^0.10.0`). Bump + push (`npm version
patch` → `git push --follow-tags`) and consumers resolve the new tag.

## Git Commits

- Do NOT include "Generated with Claude Code" or "Co-Authored-By"
- Keep commit messages concise and focused on the change

## Pushing (never automatic)

**Never `git push` without an explicit request from the user.**
Committing, bumping the version, and tagging locally are fine
within a workflow the user asked for — but pushing is an
outward-facing action and must be its own explicit instruction
("push", "push it", "ship it"). Do not treat "commit" or running
`/commit` as permission to push. When the user *does* ask to push,
use `--follow-tags` so annotated version tags reach the remote
alongside the commits. If unsure, stop after the local commit and
report the state with the exact push command for the user to run.

## Workspace Configuration

`~/dev/casomo/.claude` is a symlink to `tooling/.claude`,
making this directory the single source of truth for workspace
Claude Code config. Structure:

- **`settings.json`** — committed permissions (allow/deny).
  All Bash commands are allowed via `Bash(*)` since this is a
  local dev workspace. Destructive Git operations (force merge,
  repo delete) are blocked via the deny list. WebFetch, MCP
  tools, and Skills are allowed per-domain/per-tool.
- **`settings.local.json`** — gitignored. Only for secrets
  (`env` block with `NPM_TOKEN`), machine-local overrides, and
  non-Bash tool approvals (WebFetch domains, MCP tools) that
  accumulate during sessions. Promote useful ones to
  `settings.json` via a reviewed commit, or delete.
- **`CLAUDE.md`** — this file (committed)
- **`skills/`** — skill definitions (committed)

Individual repos (e.g. hub-site) should NOT have their own
`.claude/settings.local.json` — they inherit workspace
permissions through the symlink.

## Skills

Skills live in `tooling/.claude/skills/` and are available at the
workspace root via the `.claude` symlink. Available skills:
- `/commit` — check, version bump, commit, push workflow
- `/frontend-design` — design-thinking-first UI development
- `/keyword-map` — portfolio keyword-ownership & cannibalisation audit
- `/release-version` — version bump → push → Release tail (after `/commit`)
- `/screenshot` — capture and analyse dev server pages
- `/seo` — on-page SEO checklist and content rules
- `/triage-backlog` — triage the execution backlog (TODO.md)
- `/typescript` — TypeScript data modelling and type design
- `/write-copy` — Casomo voice and tone for all prose
