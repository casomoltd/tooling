---
name: release-version
description: >-
  Run the release tail after a commit — bump the version with the repo's
  own tooling, then (only on an explicit push request) push so the
  configured CI trigger publishes or deploys. NOT for committing — that's
  the commit skill.
user-invocable: true
argument-hint: "[patch|minor] [-C <repo>]"
allowed-tools:
  - Bash(npm version *)
  - Bash(uv version *)
  - Bash(git *)
  - Bash(gh *)
  - Bash(cd *)
  - Bash(cd * && git *)
  - Read
  - Glob
  - Grep
---

# Release Workflow

The **release tail** that `commit` stops short of: **bump → push →
(CI) publish/deploy**. It assumes the code is **already committed**;
it does not commit code. Steps are mechanics + routing — follow in
order.

## Intent

Run the release tail on an already-committed tree — bump the version with the
repo's own tooling, then (only on an explicit push request) push so CI
publishes/deploys. One job: release. Not commit.

## 0. Resolve the target repo

Decide which repo to release:

- `-C <path>` given → that directory (resolved relative to the current
  dir, git-style; e.g. `-C tooling` from a multi-repo workspace root).
- otherwise → the current directory.

Confirm it's the intended repo and take its absolute path with
`cd <path> && git rev-parse --show-toplevel`. If it isn't a git repo with a
recognised toolchain, **stop and ask** — guessing here is exactly how a bump
lands in the wrong directory. `<repo>` below is that absolute path, and every
command runs in it as `cd <repo> && …`.

## 1. Precondition — clean working tree

```bash
git status --porcelain
```

Any output (uncommitted/staged changes) → **stop** and commit first. A
clean tree is the contract between committing and releasing.

## 2. Detect the toolchain and the publish trigger

Decide from the files present, not a hardcoded list:

- `package.json` present → **npm repo**.
- `pyproject.toml`, no `package.json` → **Python/uv repo**.

Then learn **what a push will do** by reading the CI workflow's `on:`
block — it is the source of truth, so don't assume:

```bash
Read .github/workflows/*.yml   # inspect the `on:` triggers
```

Common shapes:

- **Publish on tag push** (`on: push: tags: ['v*']`) — pushing the
  annotated version tag publishes the package (e.g. via OIDC trusted
  publishing). The step 5 push carries the tag, so the push itself
  triggers the release; no separate GitHub Release is needed.
- **Publish/deploy on branch push** (`on: push: branches: [main]`) — the
  push to the default branch is what publishes or deploys (e.g. a Vercel
  app). No tag trigger, no Release step.
- **Publish on release** (`on: release:`) — a GitHub Release is required
  to publish; the push alone won't (`gh release create` in step 5).
- **No publish workflow** — versioning only (e.g. a pure ops repo): bump
  and tag, nothing publishes.

## 3. Confirm the bump level

`minor` if requested, else **patch** (default). Confirm before bumping.
**Never** run a major bump (`npm version major` / `uv version --bump
major`) without explicit user approval.

## 4. Bump — with the repo's own tooling (never hand-edit)

First fetch the remote's tags:

```bash
cd <repo> && git fetch origin --tags
```

A tag only the remote holds is otherwise invisible until the push collides;
fetched, it makes `npm version` refuse that version. Then stop and report it
to the user rather than bump past it: a version tag you didn't make is a
release from another clone, or another repo's history reaching this one.

- **npm repo** — atomic: `npm version patch` (or `minor`) edits
  `package.json`, commits, and creates an **annotated** tag in one step.
- **Python/uv repo** — `uv version` only edits files; commit and tag by
  hand:
  ```bash
  uv version --bump patch        # or minor
  git add pyproject.toml uv.lock
  git commit -m "v<new-version>"
  git tag -a "v<new-version>" -m "v<new-version>"
  ```
  The tag **must be annotated** (`-a`) — `--follow-tags` silently skips
  lightweight tags.

**Run the bump alone.** Run it as a command of its own, as every commit step is
([`commit.md`](../../docs/commit.md#the-steps)), and never in a parallel tool
call beside any other command: sent in parallel, it can run in another repo's
working directory and tag the wrong package.

## 5. Stop before pushing — push is outward-facing

Pushing is **never** automatic. After the bump, report the local state
(new commit + tag) and show the command:

```bash
cd <repo> && git push --atomic --follow-tags origin <default branch>
```

`<default branch>` is the branch step 2's workflow publishes or deploys from
(`main` in a repo on this package's gates).

`--atomic` makes the remote take the branch and its tags together or not at
all, so a push the remote refuses (the wrong repo, a branch behind) carries no
tag with it. Push one repo at a time, never in parallel with another push.

Push **only on an explicit request** ("push", "ship it"). Invoking this
skill is not push permission. **Flag the consequence first**, from the
trigger detected in step 2: a tag-push or branch-push will *publish*;
a branch push to an app will *deploy to production*; a release-triggered
package needs `gh release create v<new-version>` after the push to
actually publish.

When the user asks, push, then confirm the tag landed and (for packages)
wait for the run:

```bash
cd <repo> && git ls-remote --tags origin | grep "v<new-version>"
gh run list -L 1
```

If a tag didn't reach the remote (created lightweight), push it
explicitly — `cd <repo> && git push origin v<new-version>` —
don't delete/recreate.

## Boundaries

- **vs `commit`** — that skill produces the committed, clean tree this one
  requires (step 1); this skill never commits *code* (only the version-bump commit
  its own tooling makes). Bump / push / publish is this skill's lane, not
  `commit`'s.

## Guardrails

- Never major-bump without explicit approval.
- Never hand-edit the `version` field or hand-create tags — always the
  repo's own tooling.
- Push only on an explicit instruction, and flag the publish/deploy
  consequence first.

## Error recovery

Never use destructive git commands to "fix" a mistake — no `git tag -d`,
`git reset --hard`, `git push --force`, or history rewrites. Version
numbers are cheap; clean history is not.

- **Bumped twice / wrong level:** accept the higher number, move on.
- **Bumped in the wrong directory:** accept it (harmless), then bump the
  intended one.
- **Tag didn't reach the remote:** push it explicitly; don't recreate.
- **Push fails:** find the cause (upstream changes, hook rejection) and
  resolve without rewriting history.
