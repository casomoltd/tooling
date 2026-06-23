---
name: commit
description: >-
  Run checks and commit cleanly — detect the toolchain, run the repo's
  checks, stage explicitly, show the diff for approval, write a
  conventional message. Does NOT bump the version (that's
  release-version) or push (a separate, explicitly-requested step).
user-invocable: true
argument-hint: "[message]"
allowed-tools:
  - Bash(npm run check)
  - Bash(uv run *)
  - Bash(git *)
---

# Commit Workflow

Run checks, then commit. Follow these steps in order; do NOT skip or
reorder. This skill **commits only** — it does not bump the version or
push. The release tail (bump → push → publish/deploy) is a separate,
deliberate step (`release-version`).

## 1. Run checks

Pick the command by toolchain, detected from the repo root:

- **npm repo** (`package.json` present): `npm run check`
- **Python/uv repo** (`pyproject.toml`, no `package.json`): there's no
  `npm run check`; run the strict suite directly, e.g.
  `uv run ruff check && uv run ruff format --check && uv run pyright &&
  uv run pytest`

If checks fail, fix the issues and re-run until they pass. Do NOT
proceed until they pass.

## 2. Stage changed files

Stage files explicitly by name. **Never** `git add -A` or `git add .` —
list specific files. Review with `git diff --stat` first.

## 3. Check for remaining unstaged changes

After staging, run `git diff --stat` again. If there are related changes
that should ship together, make **multiple commits** (repeat steps 2–4
per batch) rather than lumping unrelated work into one commit.

## 4. Show the diff and wait for approval

Run `git diff --staged` and present it. **Stop and wait for explicit
approval** before committing. Do not proceed until the user confirms.

## 5. Commit

- **Header:** ≤ 50 chars, imperative mood.
- **Body** (optional): wrap at 72 chars, explain *why*.
- **No AI attribution** — no "Co-Authored-By" / "Generated with …" lines.
- **Issue reference:** if an issue number is already in context, add a
  `Closes #<n>` / `Refs #<n>` footer; don't prompt for one otherwise.

Use a quoted message from the arguments if given.

## 6. Stop — do not bump, do not push

The version bump and push are **not** part of committing. After the
commit, report the local state and hand off: the release tail lives in
`release-version`, and pushing happens only on an explicit request.

## Error recovery

Never use destructive git commands to "fix" a mistake — no
`git reset --hard`, `git push --force`, or history rewrites. Clean
history is worth more than a tidy-looking sequence.

- **Pre-commit hook fails after staging:** fix the issue and make a
  **new** commit — never amend a commit that has been shared.
- **Wrong files staged:** unstage with `git restore --staged <file>` and
  re-stage correctly; don't force anything.
