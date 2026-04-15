---
name: commit
description: >-
  Run checks, bump version, commit, and push following
  Casomo conventions
user-invocable: true
argument-hint: "<repo> [patch|minor] [message]"
allowed-tools:
  - Bash(npm run check)
  - Bash(npm version *)
  - Bash(git *)
---

# Casomo Commit Workflow

Follow these steps in order. Do NOT skip or reorder steps.

## 0. Identify the target repo

The first word in `$ARGUMENTS` is the **repo name** — a
subdirectory of `$WORKSPACE_ROOT` (e.g. `tooling`,
`hub-site`, `ltd-site`, `design-tokens`, `paye-calc`,
`foundry`, `infra`).

**All commands below must run from that directory.**

If `WORKSPACE_ROOT` is not set, **stop and ask the user**
to set it before continuing.

If no repo name is given, **stop and ask the user** which
repo to commit in. Do not guess.

## 1. Run checks

```bash
cd "$WORKSPACE_ROOT/<repo>" && npm run check
```

If checks fail, fix the issues and re-run until they pass.
Do NOT proceed until checks pass.

## 2. Stage changed files

Stage files explicitly by name. **Never** use `git add -A` or
`git add .` — always list specific files.

Review what you are staging with `git diff --stat` first.

## 3. Show diff and wait for approval

Run `git diff --staged` and present it to the user. **Stop and
wait for the user to approve** before committing. Do NOT
proceed until the user explicitly confirms the diff is OK.

## 4. Commit code changes

Create a commit with a concise message:
- **Header**: max 50 characters, imperative mood
- **Body** (optional): wrap at 72 characters, explain WHY
- **No AI attribution** — no "Co-Authored-By" or
  "Generated with Claude Code" lines

If `$ARGUMENTS` contains a quoted message or text after the
version keyword, use it as the commit message.

## 5. Bump version

Run the appropriate version bump:

- Default: `npm version patch`
- If `$ARGUMENTS` contains "minor": `npm version minor`
- **Never run `npm version major`** — ask the user first

`npm version` creates its own commit and tag automatically.
This is why code changes must be committed first (step 4).

## 6. Push

```bash
git push --follow-tags
```

This pushes both the commits and the version tag. The
`--follow-tags` flag is required by the Casomo pre-push hook.

## Error recovery

When something goes wrong, **never** use destructive git
commands to "fix" it. No `git tag -d`, `git reset --hard`,
`git push --force`, or history rewrites — version numbers
are cheap, clean history is not.

- **`npm version` bumped twice or at the wrong level:**
  Accept the higher version number and move on.
- **`npm version` ran in the wrong directory:** Accept
  the accidental bump in that repo (it's harmless), then
  run the intended bump in the correct directory.
- **Pre-commit hook fails after staging:** Fix the issue
  and create a **new** commit — never amend.
- **Push fails:** Investigate the cause (upstream changes,
  hook rejection) and resolve without rewriting history.
