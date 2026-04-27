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

Run `npm run check` before committing. Each repo's `check` script
runs whatever validation that project needs.

## Versioning

Use `npm version patch` or `npm version minor` to bump versions.
This updates `package.json`, creates a commit, and tags atomically
— never edit the version field manually or create tags by hand.
**Never run `npm version major`** — major bumps require explicit
user approval.

## Publishing to GitHub Packages

Packages publish via GitHub Actions on push to main. After pushing
a new version of a dependency (e.g. design-tokens), wait for the
publish workflow to complete before running `npm i` in consumers.
Check workflow status with `gh run list -L 1`.

## Git Commits

- Do NOT include "Generated with Claude Code" or "Co-Authored-By"
- Keep commit messages concise and focused on the change
- Always push with `--follow-tags` so version tags reach the
  remote alongside the commits

## Workspace Configuration

`~/dev/casomo/.claude` is a symlink to `tooling/.claude`,
making this directory the single source of truth for workspace
Claude Code config. Structure:

- **`settings.json`** — committed permissions (allow/deny).
  Edit here to change what tools are pre-approved.
- **`settings.local.json`** — gitignored. Only for secrets
  (`env` block with `NPM_TOKEN`) and machine-local overrides.
  Auto-approvals during a session land here — promote useful
  ones to `settings.json` via a reviewed commit, or delete.
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
- `/screenshot` — capture and analyse dev server pages
- `/seo` — on-page SEO checklist and content rules
- `/typescript` — TypeScript data modelling and type design
- `/write-copy` — Casomo voice and tone for all prose
