# @casomoltd/tooling

Shared linting, formatting, commit config, and CLI tools for
Casomo repos.

## What's included

### Exports

| Export | Description |
|---|---|
| `@casomoltd/tooling/eslint` | `createBaseConfig()` — ESLint flat config with Next.js, TypeScript, and SonarJS |
| `@casomoltd/tooling/eslint-lib` | ESLint config variant for library packages |
| `@casomoltd/tooling/prettier` | Prettier config object |
| `@casomoltd/tooling/commitlint` | commitlint config with `no-ai-attribution` plugin |
| `@casomoltd/tooling/knip` | Knip config for unused exports/dependencies |
| `@casomoltd/tooling/jscpd` | Copy-paste detection config |
| `@casomoltd/tooling/readability` | `scoreText()` — readability scoring for page content |
| `@casomoltd/tooling/link-checker` | `checkLinks()` — crawl built sites for broken links |

### Bin commands

| Command | Description |
|---|---|
| `check-version` | Pre-push guard — rejects push if `package.json` version hasn't changed vs `origin/main` |
| `pre-push` | Husky pre-push hook — runs check, build, link-checker, then version/tag guards |
| `pre-commit` | Husky pre-commit hook — runs `npm run check` |
| `commit-msg` | Husky commit-msg hook — runs commitlint |
| `readability` | Measure reading difficulty of page content |
| `screenshot` | Capture a dev server page via Puppeteer |
| `link-checker` | Crawl a built site for broken links |

## Install

Published to GitHub Packages. Add to your `.npmrc`:

```
@casomoltd:registry=https://npm.pkg.github.com
```

Then install as a dev dependency:

```bash
npm install -D @casomoltd/tooling
```

## Husky hooks

The package provides shared hook commands so all repos enforce
the same standards. Wire them up in `.husky/`:

**.husky/pre-commit**
```
pre-commit
```

**.husky/commit-msg**
```
commit-msg $1
```

**.husky/pre-push**
```
pre-push
```

Each repo defines its own `check` script in `package.json` —
the hooks call `npm run check` which runs whatever checks that
repo needs (lint, typecheck, spell, etc.).

**Note:** The tooling repo itself calls scripts by path in its
hooks (e.g. `./bin/check-version.sh`) because it can't resolve
its own bin commands via `node_modules/.bin`.

## Screenshot tool

Capture the running dev server for visual inspection:

```bash
npm run ss              # 1280×800 desktop capture
npm run ss contact      # desktop capture of /contact
npm run ss -- --width 390 --height 844   # mobile capture
npm run ss contact --width 390           # mobile /contact
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--width <n>` | 1280 | Viewport width in pixels |
| `--height <n>` | 800 | Viewport height in pixels |

Add these scripts to your `package.json`:

```json
{
  "screenshot": "screenshot",
  "ss": "npm run screenshot --"
}
```

Screenshots are saved to `.claude/screenshots/`. Set
`SCREENSHOT_URL` to override the default `http://localhost:3000`.

## Link checker

Crawl the built site to find broken internal and external links:

```bash
npm run check:links                    # JSON output
npm run check:links -- --pretty        # human-readable summary
npm run check:links -- --timeout 15000 # custom timeout
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--pretty` | false | Print summary to stderr |
| `--timeout <ms>` | 10000 | Per-request timeout |

Add these scripts to your `package.json`:

```json
{
  "check:links": "link-checker"
}
```

### Per-repo config

Create `link-checker.config.mjs` in the project root to skip
URLs that block bots or are known false positives:

```js
export const skip = [
  /tax\.service\.gov\.uk/,
  /example\.com/,
];
export const timeout = 10_000;
```

The checker runs against `.next/` build output by default,
so `npm run build` must complete first.

## Quality gates

There is no CI — all quality gates run locally via git hooks.
Code should be deployment-ready by the time it's pushed to
the remote.

- **pre-commit**: Runs commitlint only (fast).
- **pre-push**: Runs the full suite — `npm run check`,
  `npm run build`, `link-checker`, then version and tag
  guards. This ensures lint, typecheck, spelling, link
  integrity, and version bumps are all verified before
  code reaches the remote.

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

## Claude Code config

The `.claude/` directory contains shared Claude Code instructions
(`CLAUDE.md`) and skills that apply across all Casomo repos.

### Skills

Skills live in `.claude/skills/` and are invoked as slash commands
in Claude Code. Each skill has a `SKILL.md` with trigger rules and
domain-specific instructions.

| Skill | Description |
|---|---|
| `/commit` | Check, version bump, commit, and push workflow |
| `/frontend-design` | Design-thinking-first UI development |
| `/screenshot` | Capture and analyse dev server pages |
| `/seo` | On-page SEO checklist and content rules |
| `/typescript` | TypeScript data modelling and type design |
| `/write-copy` | Casomo voice and tone for all prose |

### Workspace setup

All repos are cloned into a single workspace directory.
Export `WORKSPACE_ROOT` in your shell profile so that
skills and scripts can find it:

```bash
export WORKSPACE_ROOT=~/dev/casomo
```

Symlinks at the workspace root point to shared config
checked into this repo:

```
$WORKSPACE_ROOT/
  CLAUDE.md                    -> tooling/claude/CLAUDE.md
  casomo.code-workspace        -> tooling/workspace/…
  tooling/claude/CLAUDE.md                # source of truth
  tooling/workspace/casomo.code-workspace # source of truth
  hub-site/CLAUDE.md                      # project-specific
  ...
```

Create the symlinks:

```bash
ln -sf tooling/claude/CLAUDE.md CLAUDE.md
ln -sf tooling/workspace/casomo.code-workspace casomo.code-workspace
```

Claude Code loads `CLAUDE.md` from the working directory.
When launched from the workspace root, it picks up the
shared conventions. Each repo also has its own `CLAUDE.md`
for project-specific instructions.

### GitHub Packages auth

Casomo packages are published to GitHub Packages under the
`@casomoltd` scope. To install them, add the registry and an
auth token to your user-level `~/.npmrc`:

```
@casomoltd:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_TOKEN>
```

The token needs the `read:packages` scope. This is a one-time
setup — all repos in the workspace will pick it up
automatically.
