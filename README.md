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
| `check-linear` | Pre-push guard — rejects a push that would put a merge commit on the remote. History is linear; a branch catches up by rebasing. Only what the push adds is judged, so merges already on the remote stay |
| `pre-push` | Husky pre-push hook — runs check, then the version, tag and linear-history guards |
| `pre-commit` | Husky pre-commit hook — runs `npm run check` |
| `commit-msg` | Husky commit-msg hook — runs commitlint |
| `readability` | Measure reading difficulty of page content |
| `screenshot` | Capture a dev server page via Playwright — an agent's visual feedback loop |
| `build-report` | Compile a Typst client report to PDF with the house template |
| `render-figures` | Pre-render a design spec's mermaid figures to static SVG |
| `spec-check` | Check a design spec's anchors, contents, figures and numbering |
| `check-private-refs` | In a public repo, refuse a private tracker link or a name listed under `privateRefs` in `casomo.config.mjs` |
| `check-personal-data` | Refuse an email, National Insurance number, UK mobile number, date of birth or locally denylisted name; per-repo allowances under `personalData` in `casomo.config.mjs` |

## Install

Published to the public npm registry. Add it to a consumer's
`devDependencies`:

```
npm i -D @casomoltd/tooling
```

```json
"@casomoltd/tooling": "^0.28.0"
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
declared — not as a dependency, and not as an optional peer.** Each loads its prerequisite lazily and fails with an
install instruction when it is missing, so a consumer that never runs
those bins carries nothing for them.

The rule, for anything added later: a heavyweight prerequisite only some
consumers need is documented here, never declared. An optional peer
looks free because npm installs nothing for it, but it resolves into a
consumer's lockfile as soon as anything pulls it in, and npm will not
prune a satisfied optional peer afterwards — not on `npm install`, not
on `npm install --package-lock-only`, not on `npm uninstall`. That is
how one dev-only browser put the `extract-zip` advisory
(GHSA-jmr9-qjv8-65gv) into four repos that never took a screenshot, and
why clearing it needed a release of this package rather than a fix in
each of them.

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
    "@casomoltd/tooling": "^0.28.0",
    "@commitlint/cli": "^20.0.0",
    "husky": "^9.1.7"
  }
}
```

Plus `commitlint.config.cjs` re-exporting the rules, and `.husky/commit-msg`.
No `version`, because the repo versions itself with its own tool. Live
examples: `kallim`, `paperpi`.

**Do not wire `pre-commit` or `pre-push` from this package in such a repo.**
Both run `npm run check`, and `check-gates` reads `package.json` and requires
eight named npm scripts — a gate a non-npm repo cannot satisfy and should not
fake. Write a `.husky/pre-push` that calls the real toolchain instead:

```sh
uv run ruff check && uv run ruff format --check && uv run pyright && uv run pytest
```

**Why this is documented here.** Undocumented, each non-npm repo solves it
alone and writes its own shell or Python copy of `no-ai-attribution`, and the
copies drift — the length limits are what they lose first. One rule, one home.
If a house gate will not run in your repo, wire the shared one or fix this
package. Do not write a local equivalent.

## Markdown / skills lint

`bin/skills-lint.config.mjs` is a stock remark config (`remark-frontmatter` +
`remark-validate-links` + `remark-lint-frontmatter-schema`) that validates a
Claude Code skills/agents/docs tree: every `SKILL.md` / `agents/*.md` has
parseable YAML frontmatter with `name` + `description`, and every relative link
and `#anchor` resolves. tooling runs it over its own `skills/` in `npm run
check` (`lint:md`) — catching the breakage a rename or hand-edit leaves that
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

A visual feedback loop for coding agents. Claude captures the page it
just changed, reads the PNG back and checks its own work, instead of
waiting for someone to look and paste a screen grab. That is what the
bin is for, and why its output lands under `.claude/`; a person wanting
a screenshot already has a browser open.

It needs a Chromium build, which this package does not install (see
[External prerequisites](#external-prerequisites)):

```bash
npm i -D playwright && npx playwright install chromium
```

Then capture the running dev server:

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

`report/` ships the Casomo house style for client-facing PDF reports —
a [Typst](https://typst.app) template (`casomo-template.typ`, with the
brand mark beside it) plus the `build-report` bin that compiles a
report to PDF:

```bash
npx build-report path/to/report.typ                # → scratch (see below)
npx build-report report.typ -o public/report.pdf   # explicit output path
npx build-report report.typ --watch                # recompile on save
npx build-report report.typ --open                 # open the PDF when done
```

The compiled PDF is a build artefact and goes to
`$SCRATCH_DIR/reports/<name>.pdf`, or `<repo-root>/scratch/reports/` when
**`SCRATCH_DIR`** is unset — add `scratch/` to the consumer repo's
`.gitignore` (this repo does). A PDF is a file to open rather than a page
to publish, so it keeps a scratch location where the x-ray reports need
none. Pass `--out` only when the PDF is a deliverable the repo actually
keeps (e.g. a site's `public/`).

A report imports the template and applies it as a show rule; everything
after is the body. From a consumer repo the import goes through
`node_modules` (the bin sets the Typst root to the nearest
`package.json`/`.git` ancestor so the path resolves):

```typst
#import "/node_modules/@casomoltd/tooling/report/casomo-template.typ": casomo-report, band

#show: casomo-report.with(
  kicker: "Delivery Report & Findings",
  title: "The Report Title",
  subtitle: "One-line summary.",  // optional
)

= Executive summary
…
```

`report/example.typ` is a lorem-ipsum reference report exercising every
feature the template styles — compile it to see the house style.

Two [external prerequisites](#external-prerequisites) apply here: the
**`typst` CLI** on PATH (`snap install typst` / `cargo install
typst-cli`) and the **IBM Plex Sans / IBM Plex Mono** fonts
([github.com/IBM/plex](https://github.com/IBM/plex)) — `build-report`
fails loud on the former and warns on the latter.

## Quality gates

Quality gates run locally via git hooks, so code is
deployment-ready by the time it reaches the remote. GitHub
Actions re-runs `check` on push and publishes on a version tag;
the local hooks are the gate, CI is the backstop.

- **pre-commit**: `npm run check` — the repo's full health gate.
- **commit-msg**: commitlint (house rules + the AI-attribution ban).
- **pre-push**: `npm run check`, then the version and tag guards.

**`check` owns the build.** A repo whose build fails is not
healthy, and any assertion that reads build output has to run
after the build in the same script — so `build` belongs in
`check`, and appears nowhere else. Declaring it in the pre-push
gate as well would give it two owners and build twice.

### What every repo's `check` must contain

`check` is a hand-written, ordered chain — the repos are
heterogeneous and some orderings are load-bearing — but its
**composition is enforced**, not remembered. Run `check-gates`
as its first step:

```json
"check": "check-gates && npm run lint && npm run typecheck && ..."
```

It fails if a required gate is missing, if one is defined but
never run (a dead gate), or if an exception outlives the problem
it was written for. Required: `lint`, `typecheck`, `test`,
`knip`, `jscpd`, `lint:md`, `spell`, `build`.

A repo opts out by declaring a **reason** — a blank one fails, so
an opt-out is never silent, and every exception is printed on
each run:

```json
"casomo": {
  "gates": { "test": "content site — no suite yet" }
}
```

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
| `/casomoltd:draft-design-spec` | Author a reviewable HTML design spec from a brief, publish it as an Artifact, and iterate on it there before writing code (drives `design-xray`) |
| `/casomoltd:page-design` | Structure a content/explainer page for trust — above-the-fold answer, disclosure, palette-only colour (rubric a page-design reviewer preloads) |
| `/casomoltd:generate-report` | Scaffold a Typst client report from the house template, compile via `build-report`, verify the PDF |

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

Three namespaced agents (`agents/`), each read-only on what it inspects and
preloading the relevant house standard as its rubric — `typescript` for
`.ts/.tsx`, `python-style` for `.py`, `docs-style` for markdown. `design-xray` and
`docs-xray` persist only their own report (see *Report output*, below).

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

**`casomoltd:docs-xray`** is the same idea for a *documentation* corpus: it walks
every markdown doc (README, `CLAUDE.md`, `docs/`, skill/agent definitions) and
returns a map — each doc's heading tree + outbound pointers, plus a mermaid
reference-graph of how the docs link — and a coherence report: orphan docs nothing
links to, stale cross-references whose summary has drifted from the target,
duplicated coverage, and missing back-links. It judges structure and
cross-reference coherence against `docs-style` — not mechanical broken links
(that's a markdown link linter) or prose voice (a content reviewer).

**`casomoltd:doc-review`** reviews *one repository doc* against `docs-style`:
whether it gets to the point or buries it under furniture, whether it is one
subject or three, whether a leaf carries an index belonging in the README,
whether a section says "not built yet" where content should be, and whether the
session's own progress has leaked in. A doc can be right in every sentence and
fail this review, because what it judges is shape. Not link validity (a markdown
link linter), not the corpus reference graph (`docs-xray`), not skills or agent
briefs (`skill-review`).

**`casomoltd:skill-review`** reviews changed *skills and agent briefs* against
`docs-style` and [the authoring schema](docs/skill-agent-schema.md): prose that
narrates its own past rather than stating current truth, a unit missing the
sections its profile needs, a rule restated from the skill that owns it, and a
description that won't route. It closes with an explicit history sweep — the
units it read and the count flagged, including zero — because that finding sits
where a justification would and otherwise survives an ordinary read-through. The
[`commit`](skills/commit/SKILL.md) skill routes staged `SKILL.md` and
`agents/*.md` changes to it. Not link validity (a markdown link linter), not the
corpus reference graph (`docs-xray`), not prose voice (a content reviewer).

**Report output.** `design-xray` and `docs-xray` write their report — the `.md`
plus an `.html` rendered by `bin/render-report.mjs` — into a working directory
and return both paths, and the caller publishes the `.html`. Each agent's
*Persist the report* section is the spec for that hand-off.

The rendered `.html` is built for that destination: `render-report.mjs` converts
the markdown in node and ships **no mermaid runtime**, because the artifact host
renders every `pre.mermaid` itself and a second runtime races it into black
boxes. A page that builds its own body at load time has no diagram blocks in it
when the host looks.

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
transitive remote tarball. The other two npm 12.0.0 regressions this
once guarded against are fixed: `npm ci` strictness (12.0.2 installs
Linux-generated locks cleanly) and the provenance/sigstore crash
(12.0.1). Re-test the fetch block before moving to npm 12.
