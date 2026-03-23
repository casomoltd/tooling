# @casomo/tooling

Shared linting, formatting, and commit config for Casomo sites.

## What's included

| Export | Description |
|---|---|
| `@casomo/tooling/eslint` | `createBaseConfig()` — ESLint flat config with Next.js, TypeScript, and SonarJS |
| `@casomo/tooling/prettier` | Prettier config object |
| `@casomo/tooling/commitlint` | commitlint config with `no-ai-attribution` plugin |

## How it's consumed

Sites reference this package as a `file:` devDependency:

```json
"devDependencies": {
  "@casomo/tooling": "file:../tooling"
}
```

The `file:` path resolves at `npm install` time on the local machine. This
is fine because all linting, typechecking, and spell-checking runs locally
before committing — there is no CI pipeline for these checks yet.

Vercel builds only install production `dependencies`, so `devDependencies`
(including this package) are skipped during remote builds. If CI-based
linting is added later, this package would need to be published to a
registry or the CI runner would need access to the monorepo layout.

## Claude Code config

The `claude/` directory contains shared Claude Code instructions
(`CLAUDE.md`) that apply across all Casomo repos.

### Workspace setup

All repos are cloned into a single workspace directory
(`~/dev/casomo/`). A symlink at the workspace root points to the
shared config:

```
~/dev/casomo/
  CLAUDE.md -> tooling/claude/CLAUDE.md   # symlink
  tooling/claude/CLAUDE.md                # source of truth
  hub-site/CLAUDE.md                      # project-specific
  mynah/CLAUDE.md                         # project-specific
  ...
```

Claude Code loads `CLAUDE.md` from the working directory. When
launched from the workspace root, it picks up the shared conventions
(code style, tool usage, git commit rules). Each repo also has its
own `CLAUDE.md` for project-specific instructions (dev commands,
architecture, etc.).

### What goes where

| File | Contents |
|---|---|
| `tooling/claude/CLAUDE.md` | Shared conventions that apply to all repos |
| `<repo>/CLAUDE.md` | Project-specific instructions (build commands, architecture, devcontainer usage) |

Keep repo-level files focused — shared rules like code style and
commit message format belong in the workspace-level file so they're
maintained in one place.

## No dependencies

This package has no `dependencies` of its own. ESLint plugins and other
tools are installed by each consuming site. The ESLint config uses a
factory function (`createBaseConfig`) that receives resolved imports from
the consumer to avoid module resolution issues.
