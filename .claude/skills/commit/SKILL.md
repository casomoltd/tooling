---
name: commit
description: >-
  Run checks, bump version, and commit following Casomo
  conventions. Pushing is a separate, explicitly-requested step
user-invocable: true
argument-hint: "<repo> [patch|minor] [message]"
allowed-tools:
  - Bash(npm run check)
  - Bash(npm version *)
  - Bash(uv run *)
  - Bash(uv version *)
  - Bash(git *)
---

# Casomo Commit Workflow

Follow these steps in order. Do NOT skip or reorder steps.

## 0. Identify the target repo

The first word in `$ARGUMENTS` is the **repo name** — a
subdirectory of `$WORKSPACE_ROOT` (e.g. `tooling`,
`hub-site`, `ltd-site`, `design-tokens`, `paye-calc`,
`infra`).

**All commands below must run from that directory.**

If `WORKSPACE_ROOT` is not set, **stop and ask the user**
to set it before continuing.

If no repo name is given, **stop and ask the user** which
repo to commit in. Do not guess.

## 1. Run checks

Pick the command by toolchain — detect it from the repo root:

- **npm repo** (`package.json` present — `hub-site`,
  `paye-calc`, `tooling`, …):
  ```bash
  cd "$WORKSPACE_ROOT/<repo>" && npm run check
  ```
- **Python/uv repo** (`pyproject.toml`, no `package.json` —
  e.g. `infra`): there is no `npm run check`. Run the strict
  suite directly:
  ```bash
  cd "$WORKSPACE_ROOT/<repo>" && uv run ruff check && \
    uv run ruff format --check && uv run pyright && uv run pytest
  ```

If checks fail, fix the issues and re-run until they pass.
Do NOT proceed until checks pass.

## 2. Stage changed files

Stage files explicitly by name. **Never** use `git add -A` or
`git add .` — always list specific files.

Review what you are staging with `git diff --stat` first.

## 3. Check for remaining unstaged changes

After staging, run `git diff --stat` to see if there are
**other** uncommitted changes in the working tree. If there
are related changes that should go out together, make
**multiple commits first** (repeat steps 2–4 for each batch)
before bumping the version. The version bump and push cover
the entire changeset — don't bump between commits.

## 4. Show diff and wait for approval

Run `git diff --staged` and present it to the user. **Stop and
wait for the user to approve** before committing. Do NOT
proceed until the user explicitly confirms the diff is OK.

## 5. Commit code changes

Create a commit with a concise message:
- **Header**: max 50 characters, imperative mood
- **Body** (optional): wrap at 72 characters, explain WHY
- **No AI attribution** — no "Co-Authored-By" or
  "Generated with Claude Code" lines
- **Issue reference**: if the conversation mentions an
  issue number (e.g. from a work plan), include a
  `Closes #<number>` or `Refs #<number>` footer.
  Don't prompt for one if it's not already in context.

If `$ARGUMENTS` contains a quoted message or text after the
version keyword, use it as the commit message.

## 6. Bump version

The level comes from `$ARGUMENTS`: `minor` → minor, else
`patch`. **Never run a major bump** (`npm version major` /
`uv version --bump major`) — ask the user first. The
mechanics differ by toolchain:

- **npm repo** — atomic: `npm version` updates
  `package.json`, commits, and creates an **annotated** tag
  in one step:
  ```bash
  npm version patch   # or: npm version minor
  ```
  This is why code changes must be committed first (step 5).

- **Python/uv repo** — `uv version` only edits files; it does
  **not** commit or tag. Do those steps by hand:
  ```bash
  uv version --bump patch        # or minor; e.g. 0.1.0 -> 0.2.0
  git add pyproject.toml uv.lock
  git commit -m "v<new-version>"
  git tag -a "v<new-version>" -m "v<new-version>"
  ```
  The tag **must be annotated** (`-a`) — `git push
  --follow-tags` silently skips lightweight tags (a bare
  `git tag v0.2.0` will not reach the remote). A pure ops
  repo with no prior tags is fine; the first bump just
  establishes versioning.

## 7. Stop — do NOT push automatically

Pushing is **never** part of the default flow. The whole release
tail — version bump → push → (for package repos) GitHub Release — has
its own skill, **`/release-version`**; running a release after a commit
is a deliberate, separate invocation. After the version bump here,
**stop and report the local state** — the new commits and tag — and
show the exact push command for the user:

```bash
git push --follow-tags
```

Only run it **if the user explicitly asks to push** ("push", "ship
it", etc.). Running `/commit`, or being asked to "commit", is NOT
permission to push. `--follow-tags` is required (the Casomo pre-push
hook needs it; it carries only annotated tags).

When the user does ask, push and confirm the tag landed:

```bash
git ls-remote --tags origin | grep "v<new-version>"
```

If the tag is missing (e.g. it was created lightweight),
push it explicitly — non-destructive — rather than deleting
and recreating it: `git push origin v<new-version>`.

## Error recovery

When something goes wrong, **never** use destructive git
commands to "fix" it. No `git tag -d`, `git reset --hard`,
`git push --force`, or history rewrites — version numbers
are cheap, clean history is not.

- **Version bumped twice or at the wrong level:**
  Accept the higher version number and move on.
- **The bump ran in the wrong directory:** Accept
  the accidental bump in that repo (it's harmless), then
  run the intended bump in the correct directory.
- **Tag created lightweight / didn't reach the remote:**
  Push it explicitly with `git push origin v<version>`. Do
  not delete and recreate it.
- **Pre-commit hook fails after staging:** Fix the issue
  and create a **new** commit — never amend.
- **Push fails:** Investigate the cause (upstream changes,
  hook rejection) and resolve without rewriting history.
