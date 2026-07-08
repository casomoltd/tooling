# @casomoltd/tooling

Shared linting, formatting, commit config, and CLI tools for Casomo Ltd's repos.

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

### Bin commands

| Command | Description |
|---|---|
| `check-version` | Pre-push guard — rejects push if `package.json` version hasn't changed vs `origin/main` |
| `pre-push` | Husky pre-push hook — runs check, build, then version/tag guards |
| `pre-commit` | Husky pre-commit hook — runs `npm run check` |
| `commit-msg` | Husky commit-msg hook — runs commitlint |
| `readability` | Measure reading difficulty of page content |
| `screenshot` | Capture a dev server page via Puppeteer |

## Install

Consumed as a **git dependency** — it's shared config + CLI scripts,
not a registry package. Add it to a consumer's `devDependencies`:

```json
"@casomoltd/tooling": "github:casomoltd/tooling#semver:^0.10.0"
```

The repo is public, so installs need no token. The `files` allowlist
plus the `verify-pack` leak-gate keep the installed surface to
configs/CLI only.

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

## Markdown / skills lint

`bin/skills-lint.config.mjs` is a stock remark config (`remark-frontmatter` +
`remark-validate-links` + `remark-lint-frontmatter-schema`) that validates a
Claude Code skills/agents/docs tree: every `SKILL.md` / `agents/*.md` has
parseable YAML frontmatter with `name` + `description`, and every relative link
and `#anchor` resolves. tooling runs it over its own `skills/` in `npm run
check` (`lint:skills`) — catching the breakage a rename or hand-edit leaves that
Claude Code's loader silently swallows.

To gate a consumer repo's docs (link/anchor integrity) at its own pre-commit,
install the remark toolchain and point it at the shipped config:

```bash
npm i -D remark-cli remark-frontmatter remark-validate-links remark-lint-frontmatter-schema
```

```json
"lint:md": "remark --frail --quiet --no-stdout --rc-path node_modules/@casomoltd/tooling/bin/skills-lint.config.mjs docs"
```

Append `&& npm run lint:md` to your `check` script. The config resolves the
plugins from your repo's `node_modules` and the schema (shipped beside it)
relative to your cwd; the frontmatter schema only matches `SKILL.md`/`agents`
files, so for plain docs it acts as a link/anchor check. Requires a tooling
version that ships the config.

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

## Quality gates

There is no CI — all quality gates run locally via git hooks.
Code should be deployment-ready by the time it's pushed to
the remote.

- **pre-commit**: Runs commitlint only (fast).
- **pre-push**: Runs the full suite — `npm run check`,
  `npm run build`, then version and tag guards. This ensures
  lint, typecheck, spelling, and version bumps are all verified
  before code reaches the remote.

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

## Claude Code skills (plugin)

This repo is a Claude Code plugin (`.claude-plugin/`) shipping the **generic,
public engineering standards** we work to across three agent-facing surfaces —
**skills**, **hooks**, and **agents**. Business-specific ones live in private
workspace config, not here.

The tooling serves three consumers: **Claude** (the editing workflow) → these
plugin surfaces; **CI + git-hooks** (automation) → the npm `bin` scripts; manual
human CLI is no longer a design target.

**Authoring standard:** creating or editing a skill/agent follows
[`docs/skill-agent-schema.md`](docs/skill-agent-schema.md) — the interface schema
(three profiles — procedural skill · agent · standard/rubric — plus a frontmatter
decision table) that keeps these units composing without overlap.

| Skill | Description |
|---|---|
| `/casomoltd:commit` | Run checks and commit cleanly (no bump, no push) |
| `/casomoltd:release-version` | Bump → push → CI publish/deploy (the release tail) |
| `/casomoltd:frontend-design` | Distinctive, production-grade frontend UI |
| `/casomoltd:python-style` | Python code-generation style rules |
| `/casomoltd:typescript` | TypeScript data modelling and type design |
| `/casomoltd:screenshot` | Capture and analyse a dev server page |
| `/casomoltd:design-pass` | Map → review → refactor a package (drives `design-xray` + `code-review`) |
| `/casomoltd:draft-design-spec` | Author a browser-reviewable HTML design spec from a brief and iterate on it before writing code (drives `design-xray`) |

Enable the plugin by adding this repo as a marketplace and installing it:

```bash
/plugin marketplace add casomoltd/tooling
/plugin install casomoltd@casomo-tooling
```

Skills then load namespaced as `/casomoltd:<name>`.

### Hooks

The plugin also ships generic **PreToolUse hooks** (`hooks/`) that guard
command/shell intent no linter or commit hook can see: confirm before
`git push`, hard-block destructive git, `npm version major`, global installs,
and edits that weaken TypeScript strictness. (They deliberately don't duplicate
what commitlint/eslint already enforce — see `hooks/README.md`.) The guards are
advisory — they ask you to confirm when they can't read a call's input, and
never hard-block on their own malfunction. They require **Node ≥ 22.18 / ≥ 24**
(they run as TypeScript `.mts` via native type-stripping — no build step).

See [`hooks/README.md`](hooks/README.md) for the full rule set, the file map,
how the hooks relate to `settings.json` permissions and skill `allowed-tools`,
and the TypeScript / vendored-types design rationale.

### Agents

Two read-only agents (`agents/`), both namespaced and both preloading the
standard skills as their rubric — they apply the `typescript` standard to
`.ts/.tsx` and the `python-style` standard to `.py`.

**`casomoltd:code-review`** enforces the *judgment-level* half of the standards —
the design calls a linter can't make (typed identifiers, static/varying
separation, swallowed exceptions; class design, polymorphism over type-codes,
value objects, EAFP, framework-first, test naming). It **complements, never
duplicates**: eslint/ruff own the mechanical rules, the built-in `/code-review`
owns correctness bugs, this owns the house design standards. Namespaced so it
doesn't collide with the bundled `/code-review`. Invoke with
`@agent-casomoltd:code-review` (or let Claude auto-delegate); it reports findings
and never edits.

**`casomoltd:design-xray`** takes a package or diff and returns the *structural*
picture: a doc-ready module inventory + mermaid class-hierarchy diagram, a weight
table (which modules/classes are too heavy or thin), prioritized design findings,
a ranked handoff of refactor targets, and a verdict on whether a heavier pattern
(e.g. a state machine) is warranted yet or premature. It feeds forward — its map
lifts straight into package docs, and its targets drive `code-review` and a
refactor pass. The `/casomoltd:design-pass` skill chains the three
(x-ray → code-review → refactor), and `/casomoltd:draft-design-spec` reuses its
current-state map as the "before" picture when authoring a pre-implementation
design spec. Like its sibling it visualizes and judges structure only — no
correctness bugs (that's `/code-review`), no lint (eslint/ruff).

**Report output & `SCRATCH_DIR`.** `design-xray` and `docs-xray` persist their
report — the `.md` plus an `.html` rendered by `bin/render-report.mjs` — so it
outlives the run and opens in a browser. Each writes to a gitignored
`<repo-root>/scratch/<agent>/` by default. Set the optional **`SCRATCH_DIR`** env
var to pool every report under one shared location instead (`$SCRATCH_DIR/<agent>/`)
— e.g. a multi-repo workspace collecting reports in one place rather than scattering
them per-repo. Publishing a report to a hosted claude.ai artifact is orchestrator-
only and on explicit request; the agents never do it.

## Package distribution

The product libraries (`@casomoltd/paye-calc`, `@casomoltd/nhs-pay`)
publish to the public npm registry via OIDC trusted publishing — install
with no auth or `.npmrc`. `@casomoltd/tooling` is **not** published; it's
consumed as a git dependency from this (public) repo.
