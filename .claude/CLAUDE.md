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

## Skills

Skills live in `tooling/.claude/skills/` and are available at the
workspace root via the `.claude` symlink. Available skills:
- `/frontend-design` — design-thinking-first UI development
- `/write-copy` — Casomo voice and tone for all prose
- `/commit` — check, version bump, commit, push workflow
- `/screenshot` — capture and analyse dev server pages
