---
name: commit
description: >-
  Run checks, bump version, commit, and push following
  Casomo conventions
user-invocable: true
argument-hint: "[patch|minor] [message]"
allowed-tools:
  - Bash(npm run check)
  - Bash(npm version *)
  - Bash(git *)
---

# Casomo Commit Workflow

Follow these steps in order. Do NOT skip or reorder steps.

## 1. Run checks

```bash
npm run check
```

If checks fail, fix the issues and re-run until they pass.
Do NOT proceed until checks pass.

## 2. Stage changed files

Stage files explicitly by name. **Never** use `git add -A` or
`git add .` — always list specific files.

Review what you are staging with `git diff --stat` first.

## 3. Commit code changes

Create a commit with a concise message:
- **Header**: max 50 characters, imperative mood
- **Body** (optional): wrap at 72 characters, explain WHY
- **No AI attribution** — no "Co-Authored-By" or
  "Generated with Claude Code" lines

If `$ARGUMENTS` contains a quoted message or text after the
version keyword, use it as the commit message.

## 4. Bump version

Run the appropriate version bump:

- Default: `npm version patch`
- If `$ARGUMENTS` contains "minor": `npm version minor`
- **Never run `npm version major`** — ask the user first

`npm version` creates its own commit and tag automatically.
This is why code changes must be committed first (step 3).

## 5. Push

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
