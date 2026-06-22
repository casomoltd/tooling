---
name: release-version
description: >-
  Run the release tail that /commit stops short of: bump the version
  with the repo's own tooling, then (only on an explicit push request)
  push and, for package repos, cut a GitHub Release that triggers the
  publish workflow. Use on release/ship intent for an already-committed
  repo. NOT for committing — that's /commit.
user-invocable: true
argument-hint: "<repo> [patch|minor]"
allowed-tools:
  - Bash(npm version *)
  - Bash(uv version *)
  - Bash(git *)
  - Bash(gh *)
  - Read
  - Glob
  - Grep
---

# Casomo Release Workflow

This skill owns the **release tail** that `/commit` deliberately stops
short of: **version bump → push → (package repos) GitHub Release**.
`/commit` ends at the commit; this is a separate, deliberate step.

It assumes the code is **already committed**. It does **not** commit code
changes — if the tree is dirty, it stops and sends you to `/commit`.

Do **not** restate version/publish/push constants here — read the
workspace `CLAUDE.md` (§Versioning, §Publishing to GitHub Packages,
§Pushing) for the rules. The steps below are mechanics + routing only.

Follow these steps in order. Do NOT skip or reorder steps.

## 0. Identify the target repo

The first word in `$ARGUMENTS` is the **repo name** — a subdirectory of
`$WORKSPACE_ROOT` (e.g. `tooling`, `hub-site`, `paye-calc`, `nhs-pay`,
`design-tokens`, `infra`).

**All commands below must run from that directory.**

If `WORKSPACE_ROOT` is not set, **stop and ask the user** to set it.
If no repo name is given, **stop and ask the user** which repo to
release. Do not guess.

## 1. Precondition — clean working tree

```bash
cd "$WORKSPACE_ROOT/<repo>" && git status --porcelain
```

If there is **any** output (uncommitted or staged changes), **stop** and
tell the user to run `/commit` first. This skill owns the tail *after*
the code is committed — it does not commit code. A clean tree is the
contract between `/commit` and `/release-version`.

## 2. Detect the repo type and route

Decide from the files present, **not** a hardcoded repo list:

- `package.json` present → **npm repo**.
- `pyproject.toml` and **no** `package.json` → **Python/uv repo** (e.g.
  `infra`).

Within npm repos, the **publish trigger** decides what step 5/6 do.
Inspect the workflow's `on:` block — it is the source of truth; do **not**
assume from the repo name (triggers differ between packages):

```bash
cd "$WORKSPACE_ROOT/<repo>" && \
  Read .github/workflows/publish.yml   # read the `on:` block
```

Three sub-types result:

- **Publish-on-release package** → `publish.yml` triggers on
  `release:`. A push does **not** publish; you must cut a GitHub Release
  (step 6) to publish to GitHub Packages.
- **Publish-on-push package** → `publish.yml` triggers on `push:` (to
  `main`). The **push itself publishes** — there is **no** Release step;
  just wait for the publish run after pushing.
- **Deploy target** → no `publish.yml`; deploys on push (hub-site →
  Vercel). The push *is* the deploy; no publish, no Release.

A Python/uv ops repo (infra) has no publish workflow at all: versioning
only, no publish, no Release.

## 3. Confirm the bump level

The level comes from `$ARGUMENTS`: `minor` → minor, else **patch**
(default). Confirm the level with the user before bumping.

**Never run a major bump** (`npm version major` / `uv version --bump
major`) — major bumps require **explicit user approval**. If the user
asks for major, stop and confirm before proceeding.

## 4. Bump the version — by toolchain

Always use the repo's own tooling. **Never** hand-edit the `version`
field or hand-create tags.

- **npm repo** — atomic: `npm version` edits `package.json`, commits,
  and creates an **annotated** tag in one step:
  ```bash
  npm version patch   # or: npm version minor
  ```
  The husky pre-commit hook re-runs `npm run check`, so the bump commit
  is validated automatically.

- **Python/uv repo** — `uv version` only edits files; it does **not**
  commit or tag. Do those by hand:
  ```bash
  uv version --bump patch        # or minor
  git add pyproject.toml uv.lock
  git commit -m "v<new-version>"
  git tag -a "v<new-version>" -m "v<new-version>"
  ```
  The tag **must be annotated** (`-a`) — `git push --follow-tags`
  silently skips lightweight tags.

## 5. Stop before pushing — push is outward-facing

Pushing is **never** automatic. After the bump, **report the local
state** (new commit + tag) and show the exact command:

```bash
git push --follow-tags
```

Only push **if the user explicitly asks** ("push", "ship it", etc.).
Invoking `/release-version` is **not** push permission.

**Flag the consequence of the push** so the user knows what they are
triggering (from the trigger detected in step 2):
- **Publish-on-release package:** a push alone does **not** publish —
  publishing happens on the GitHub Release (step 6).
- **Publish-on-push package:** the push **publishes the package**
  immediately via the workflow — wait for the run (step 6).
- **Deploy target (hub-site):** the push **deploys to production** via
  Vercel.

When the user does ask, push and confirm the tag landed:

```bash
git ls-remote --tags origin | grep "v<new-version>"
```

If the tag is missing (e.g. created lightweight), push it explicitly —
non-destructive — rather than deleting and recreating it:
`git push origin v<new-version>`.

## 6. Publish — depends on the trigger from step 2

- **Publish-on-release package:** the Release is what actually
  publishes. After the push:
  ```bash
  gh release create v<new-version> --title "v<new-version>" --notes "..."
  ```
  This triggers `publish.yml`.
- **Publish-on-push package:** the push already triggered the publish —
  do **NOT** create a Release; it would do nothing useful.

Either way, for a package, **wait for the publish run** before any
consumer `npm i`:

```bash
gh run list -L 1
```

**Never** create a Release for a non-package repo:
- **hub-site** — the push in step 5 is the deploy; no Release.
- **infra** — a pure ops repo: versioning only, no publish, no Release.

## Guardrails (always enforce)

- **Never** `npm version major` / `uv version --bump major` without
  explicit user approval.
- **Never** hand-edit the `version` field or hand-create tags — always
  the repo's own tooling.
- **Push only on an explicit push instruction**, and flag the
  publish/deploy consequence first.

## Error recovery

When something goes wrong, **never** use destructive git commands to
"fix" it. No `git tag -d`, `git reset --hard`, `git push --force`, or
history rewrites — version numbers are cheap, clean history is not.

- **Version bumped twice or at the wrong level:** Accept the higher
  version number and move on.
- **The bump ran in the wrong directory:** Accept the accidental bump
  there (it's harmless), then run the intended bump in the correct
  directory.
- **Tag created lightweight / didn't reach the remote:** Push it
  explicitly with `git push origin v<version>`. Do not delete and
  recreate it.
- **Pre-commit hook fails after staging:** Fix the issue and create a
  **new** commit — never amend.
- **Push fails:** Investigate the cause (upstream changes, hook
  rejection) and resolve without rewriting history.
- **Release created for the wrong version:** Create a corrected Release
  for the right tag; don't delete history to hide the mistake.
