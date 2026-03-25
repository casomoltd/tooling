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

## Git Commits

- Do NOT include "Generated with Claude Code" or "Co-Authored-By"
- Keep commit messages concise and focused on the change
- Always push with `--follow-tags` so version tags reach the
  remote alongside the commits
