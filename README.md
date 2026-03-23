# @casomoltd/tooling

Shared linting, formatting, and commit config for Casomo repos.

## What's included

| Export | Description |
|---|---|
| `@casomoltd/tooling/eslint` | `createBaseConfig()` — ESLint flat config with Next.js, TypeScript, and SonarJS |
| `@casomoltd/tooling/prettier` | Prettier config object |
| `@casomoltd/tooling/commitlint` | commitlint config with `no-ai-attribution` plugin |

## Install

Published to GitHub Packages. Add to your `.npmrc`:

```
@casomoltd:registry=https://npm.pkg.github.com
```

Then install as a dev dependency:

```bash
npm install -D @casomoltd/tooling
```

## Local development

Changes to tooling require a push to `main` to publish (the
workflow runs automatically). Consuming repos then pick up
changes with `npm update @casomoltd/tooling`.

For fast iteration while editing tooling config locally, use
`npm link` to temporarily symlink your local checkout:

```bash
# in the consuming repo
npm link ../tooling
```

This overrides the published version until the next
`npm install`, which restores the registry version.

## Usage

**.prettierrc.js**
```js
module.exports = require('@casomoltd/tooling/prettier');
```

**commitlint.config.cjs**
```cjs
module.exports = require('@casomoltd/tooling/commitlint');
```

**eslint.config.mjs**
```js
import { createBaseConfig } from '@casomoltd/tooling/eslint';
```

The ESLint config uses a factory function that receives
resolved imports from the consumer to avoid module resolution
issues across package boundaries.

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
  ...
```

Claude Code loads `CLAUDE.md` from the working directory. When
launched from the workspace root, it picks up the shared
conventions. Each repo also has its own `CLAUDE.md` for
project-specific instructions.

## No runtime dependencies

This package has no `dependencies` of its own. ESLint plugins
and other tools are installed by each consuming site.
