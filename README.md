# @casomoltd/tooling

Shared linting, formatting, commit config, and CLI tools for Casomo Ltd's repos.

## What's included

### Exports

| Export | Description |
|---|---|
| `@casomoltd/tooling/eslint` | `createBaseConfig()` — ESLint flat config with Next.js, TypeScript, SonarJS and the house rules ([docs/lint.md](docs/lint.md)) |
| `@casomoltd/tooling/eslint-lib` | `createLibConfig()` — the same house rules for a TypeScript library ([docs/lint.md](docs/lint.md)) |
| `@casomoltd/tooling/prettier` | Prettier config object |
| `@casomoltd/tooling/commitlint` | commitlint config with `no-ai-attribution` plugin |
| `@casomoltd/tooling/knip` | Knip config for unused exports/dependencies |
| `@casomoltd/tooling/jscpd` | Copy-paste detection config |
| `@casomoltd/tooling/readability` | Readability scoring for a page's or a newsletter post's prose: `scoreText()`, `FORMULAS` (the seven formulas it scores), `extractText()` and `discoverSlugs()` for a Next.js page's text, and `DEFAULT_MAX_GRADE`, `DEFAULT_WORD_SUBS` and `MIN_SCORABLE_WORDS` |
| `@casomoltd/tooling/identity` | `CASOMO_ORGANIZATION`, the schema.org `Organization`, logo included, that every Casomo site names as publisher in its JSON-LD; `LINKEDIN`, the company's LinkedIn pages (the company page and the consumer showcase); and the company's public registrations, `COMPANY_REGISTER`, `ICO_REGISTER` and `REGISTERED_OFFICE`, with `COMPANY_COLOPHON`, the lines about them every site's colophon carries; and `CASOMO_UTM` with `tagged()`, the values every Casomo link and signature is tagged from ([types](identity/index.d.mts)). App code imports it at build time, so a site that installs only production dependencies at runtime lists the package under `dependencies` |
| `@casomoltd/tooling/buttondown` | For a repo using the `buttondown` command: the shared email blocks and skins (`createEmailBlocks`, `emailBaseCss`, `composeWebSkin`), a colophon as `socials` links or email HTML (`colophonLinks`, `colophonHtml`), `tokenReader()`, `loadSettings()` and `buildPayload()`, and `EMAIL_CHROME_HIDES` and `WEB_CHROME_HIDES` ([docs/buttondown.md](docs/buttondown.md)) |
| `@casomoltd/tooling/tally` | For a repo keeping Tally forms as code: the form model and translator (`toBlocks`, `toSettings`, `blockNames`), `FormIndex` for styling that targets a block, `blockSelectors()`; `./tally/paths` alone for code that names a block without the builder; `./tally/events` for a page that embeds a form: its embed and form addresses, and a reader of what the embed posts, safe in a browser; `./tally/frame`, that form as a React component for a site on Next (`TallyFrame`, and `useBrowserValue` to read its hidden fields) ([docs/tally.md](docs/tally.md)) |
| `@casomoltd/tooling/attribution` | `utmTagger(lists)`: a function that tags a link with UTM values from lists a site owns, refusing a value not in them, and `UTM_PARAMS`, the parameter names it writes, for a site reading the tags back. `identity`'s `tagged()` is this, bound to Casomo's own lists ([types](attribution/index.d.mts)) |
| `@casomoltd/tooling/signature` | What an email signature must be to survive Gmail and Outlook (`GMAIL_LIMIT`, `DROPPED_MARKUP`, `EXPORT_SCALE`, `PNG_RGB`) and the readers a site's test holds its own signature to them with (`imageTags`, `hrefs`, `attribute`, `readPng`, `escapeRegExp`); `signatureFaults(facts)` runs every shared check on a site's signature and its own facts and lists what fails, and `cacheFault(headers)` judges the headers its images are served with; no test framework ([types](signature/index.d.mts)) |
| `@casomoltd/tooling/retention` | How long Casomo keeps what a reader sends, as every site's privacy page states it: `TALLY_CONTACT_MESSAGE_MONTHS`, `CONTACT_INBOX_DAYS`, `CONVERSATION_RECORDS_MONTHS`, and Tally's backup window, `TALLY_BACKUP_DAYS` with `TALLY_BACKUPS_URL` ([types](retention/index.d.mts)). A period only one site's forms have stays in that site |

### Bin commands

| Command | Description |
|---|---|
| `check-version` | Pre-push guard — rejects push if `package.json` version hasn't changed vs `origin/main` |
| `check-tags` | Pre-push guard — on a push to `main`, wants `push.followTags`, so the version tag ships with its bump |
| `check-linear` | Pre-push guard — rejects a push that would put a merge commit on the remote. History is linear; a branch catches up by rebasing. Only what the push adds is judged, so merges already on the remote stay |
| `pre-push` | Husky pre-push hook — the push gate ([what it runs](docs/quality-gates.md#the-hooks)) |
| `check-routes` | Pre-push gate for a Next.js site — starts `next start` against the build `check` made, requests every page in `/sitemap.xml` and follows the links a site promises (`routes.links` in `casomo.config.mjs`, and each form in its `tally` registry) through their redirects, and fails if any final response is not a 200 ([how](bin/check-routes.mjs)). Run it as `"check:routes": "check-routes"`; [why it runs on push](docs/quality-gates.md#check-owns-the-build) |
| `pre-commit` | Husky pre-commit hook — runs `npm run check` |
| `commit-msg` | Husky commit-msg hook — runs commitlint, then `check-listed-files` |
| `check-listed-files` | Refuse a commit that changes a file still listed in `eslint-suppressions.json`, unless a `Lint-deferred:` trailer says why ([docs/lint.md](docs/lint.md)) |
| `readability` | Measure reading difficulty of page content |
| `screenshot` | Capture a dev server page via Playwright — an agent's visual feedback loop |
| `build-report` | Compile a Typst client report to PDF with the house template |
| `render-figures` | Pre-render a design spec's mermaid figures to static SVG |
| `spec-check` | Check a design spec's anchors, contents, figures and numbering |
| `check-private-refs` | In a public repo, refuse a private tracker link or a name listed under `privateRefs` in `casomo.config.mjs` |
| `check-personal-data` | Refuse an email, National Insurance number, UK mobile number, date of birth or locally denylisted name; per-repo allowances under `personalData` in `casomo.config.mjs` |
| `buttondown` | Keep a Buttondown newsletter as code: `diff` and `apply` its fields (settings, skins and email templates) and tags, `check` the skins, sync their tokens, and create drafts ([docs/buttondown.md](docs/buttondown.md)) |
| `tally` | Keep Tally forms as code: `push` a form and read it back, `diff` it against the live form, and sync its stylesheet's tokens ([docs/tally.md](docs/tally.md)) |

## Install

Published to the public npm registry. Add it to a consumer's
`devDependencies`:

```
npm i -D @casomoltd/tooling
```

The package is public, so installs need no token or `.npmrc`. The `files`
allowlist plus the `verify-pack` leak-gate keep the published surface to
configs/CLI only.

**Installing this package never installs a browser.** The `screenshot`
bin needs one and `build-report` needs the `typst` CLI, but neither is
declared here — see [External prerequisites](#external-prerequisites).

## External prerequisites

Three bins need something npm cannot sensibly deliver: `screenshot` and
`render-figures` need a Chromium build through Playwright, and
`build-report` needs the `typst` CLI and the IBM Plex fonts. **None is
declared — not as a dependency, and not as an optional peer.** Each loads
its prerequisite lazily and fails with an install instruction when it is
missing, so a consumer that never runs those bins carries nothing for them.

The rule, for anything added later: a heavyweight prerequisite only some
consumers need is documented here, never declared. An optional peer
looks free because npm installs nothing for it, but it resolves into a
consumer's lockfile as soon as anything pulls it in, and npm will not
prune a satisfied optional peer afterwards — not on `npm install`, not
on `npm install --package-lock-only`, not on `npm uninstall`. So any
advisory against it reaches repos that never run the bin, and clearing
it takes a release of this package rather than a fix in each of them.

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

### A repo whose toolchain is not npm

A Python, Go or C++ repo still gets the commit rules. It carries a **dev-only
npm layer** that exists to host the hook and nothing else:

```json
{
  "name": "<repo>-hooks",
  "private": true,
  "description": "Dev-only npm layer: wires the shared commit-msg gate into this repo. Not the project toolchain.",
  "scripts": { "prepare": "husky" },
  "devDependencies": {
    "@casomoltd/tooling": "^<current>",
    "@commitlint/cli": "^20.0.0",
    "husky": "^9.1.7"
  }
}
```

Plus `commitlint.config.cjs` re-exporting the rules, and `.husky/commit-msg`.
No `version`, because the repo versions itself with its own tool.

**Do not wire `pre-commit` or `pre-push` from this package in such a repo.**
Both run `npm run check`, and `check-gates` reads `package.json` and requires
eight named npm scripts — a gate a non-npm repo cannot satisfy and should not
fake. Write a `.husky/pre-push` that calls the real toolchain instead:

```sh
uv run ruff check && uv run ruff format --check && uv run pyright && uv run pytest
```

If a house gate will not run in your repo, wire the shared one or fix this
package, never a local copy: [Wire a missing gate, never rewrite
it](docs/quality-gates.md#wire-a-missing-gate-never-rewrite-it).

## Markdown / skills lint

`bin/skills-lint.config.mjs` is a stock remark config (`remark-frontmatter` +
`remark-validate-links` + `remark-lint-frontmatter-schema`) that validates a
Claude Code skills/agents/docs tree: every `SKILL.md` / `agents/*.md` has
parseable YAML frontmatter with `name` + `description`, and every relative link
and `#anchor` resolves. tooling runs it in `npm run check` as `lint:md`, over
the paths that script names in [`package.json`](package.json) — catching the
breakage a rename or hand-edit leaves that Claude Code's loader silently
swallows.

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

`screenshot` is a visual feedback loop for coding agents: Claude captures the
page it just changed, reads the PNG back and checks its own work. It needs a
Chromium build, which this package does not install (see [External
prerequisites](#external-prerequisites)). Setup, flags, presets and output
location are in the [`screenshot`](skills/screenshot/SKILL.md) skill.

## Design specs

`spec-check` reads one HTML design spec and reports its mechanical
faults: an anchor resolving to nothing, a contents entry disagreeing
with its heading, a figure without a number, an anchor or a caption, a
figure wider than the card it sits in, a section number typed where the
stylesheet generates one, and markup the artifact host refuses.

`render-figures` rewrites a spec's mermaid figures as static SVG, so the
page carries no runtime. Each figure keeps its source in an HTML comment
above it, and a run reads those back, renders them and freezes the
computed paint inline. It resolves Playwright from the working directory;
set `RENDER_FIGURES_RESOLVE_FROM` to a project that has it when running
from somewhere else.

## Client reports (Typst)

`report/` ships the Casomo house style for client-facing PDF reports: a
[Typst](https://typst.app) template (`casomo-template.typ`, with the brand mark
beside it) and the `build-report` bin that compiles a report to PDF.
`report/example.typ` is a lorem-ipsum reference exercising every feature the
template styles. How a report imports the template, where the PDF lands and
the [external prerequisites](#external-prerequisites) it needs are in the
[`generate-report`](skills/generate-report/SKILL.md) skill.

## Quality gates

The hooks are the gate and CI the backstop. What each hook runs, why `check`
owns the build, the gates every repo's `check` must contain, and the rule that a
failing check is fixed rather than weakened are in
[docs/quality-gates.md](docs/quality-gates.md).

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
configuration, not here.

The tooling serves three consumers: **Claude** (the editing workflow) → these
plugin surfaces; **CI + git-hooks** (automation) → the npm `bin` scripts. The CLI
is not designed for manual human use.

**Authoring standard:** creating or editing a skill/agent follows
[`docs/skill-agent-schema.md`](docs/skill-agent-schema.md) — the interface schema
(three profiles — procedural skill · agent · standard/rubric — plus a frontmatter
decision table) that keeps these units composing without overlap.

| Skill | Description |
|---|---|
| [`/casomoltd:commit`](skills/commit/SKILL.md) | Run checks and commit cleanly (no bump, no push) |
| [`/casomoltd:release-version`](skills/release-version/SKILL.md) | Bump → push → CI publish/deploy (the release tail) |
| [`/casomoltd:design-pass`](skills/design-pass/SKILL.md) | Map → review → refactor a package |
| [`/casomoltd:draft-design-spec`](skills/draft-design-spec/SKILL.md) | Author a reviewable HTML design spec before writing code |
| [`/casomoltd:screenshot`](skills/screenshot/SKILL.md) | Capture and analyse a dev server page |
| [`/casomoltd:generate-report`](skills/generate-report/SKILL.md) | Scaffold and compile a Typst client report, verify the PDF |
| [`/casomoltd:session-todo`](skills/session-todo/SKILL.md) | Write and work a session handover list |
| [`casomoltd:typescript`](skills/typescript/SKILL.md) | TypeScript data modelling and type design (rubric) |
| [`casomoltd:python-style`](skills/python-style/SKILL.md) | Python code-generation style rules (rubric) |
| [`casomoltd:docs-style`](skills/docs-style/SKILL.md) | Technical and reference doc convention (rubric) |
| [`/casomoltd:frontend-design`](skills/frontend-design/SKILL.md) | Distinctive, production-grade frontend UI (rubric) |
| [`/casomoltd:page-design`](skills/page-design/SKILL.md) | Content-page structure for trust (rubric) |

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

Namespaced agents (`agents/`), each read-only on what it inspects and
preloading the house standard it applies. Each file's frontmatter and *Scope*
say what it does and does not cover.

| Agent | Reviews or maps |
|---|---|
| [`casomoltd:code-review`](agents/code-review.md) | Changed code against the house design standards |
| [`casomoltd:design-xray`](agents/design-xray.md) | A package's structure: map, weights, refactor targets |
| [`casomoltd:docs-xray`](agents/docs-xray.md) | A docs corpus: map, reference graph, coherence |
| [`casomoltd:doc-review`](agents/doc-review.md) | One repository doc's shape |
| [`casomoltd:skill-review`](agents/skill-review.md) | Changed skills and agent briefs |
| [`casomoltd:spec-review`](agents/spec-review.md) | An HTML design spec against its authoring rubric |

`design-xray` and `docs-xray` persist their report and the caller publishes it:
[An agent that persists a
report](docs/skill-agent-schema.md#an-agent-that-persists-a-report).

## Package distribution

`@casomoltd/tooling`, alongside the product libraries
(`@casomoltd/paye-calc`, `@casomoltd/nhs-pay`), publishes to the public
npm registry via OIDC trusted publishing — install with no auth or
`.npmrc`. A version-tag push (`npm version patch` → `git push
--follow-tags`) triggers `publish.yml`. That workflow carries **no npm
pin**: it builds on Node 24, whose bundled npm 11.x is already the range
we want — at or above the `npm >= 11.5.1` trusted publishing needs, and
short of npm 12, which still refuses non-registry fetches by default
(`EALLOWREMOTE`) and so cannot regenerate a lockfile that resolves a
transitive remote tarball. Re-test the fetch block before moving to
npm 12.
