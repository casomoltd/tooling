---
name: commit
description: >-
  Run checks, then stage, review, and commit cleanly behind an explicit
  confirmation gate — detect the toolchain, run the repo's checks, stage
  explicitly, review the staged diff with the house agents, show the diff and
  wait for the user to confirm, then write a conventional commit. The commit is
  never silent — the guard hook confirms every `git commit`. Does NOT bump the
  version (that's release-version) or push (a separate, explicitly-requested
  step).
user-invocable: true
argument-hint: "[message] [-C <repo>]"
allowed-tools:
  - Bash(npm run check)
  - Bash(uv run *)
  - Bash(git *)
  - Bash(cd *)
---

# Commit Workflow

Run checks, then commit. Follow these steps in order; do NOT skip or
reorder. This skill **commits only** — it does not bump the version or
push. The release tail (bump → push → publish/deploy) is a separate,
deliberate step (`release-version`).

## Intent

Take a dirty working tree to a clean, reviewed, conventional commit — stage and
review first, then commit **only after the user confirms** — and stop there. One
job: commit, behind an explicit confirmation gate. Not bump, not push.

## 0. Resolve the target repo

Decide which repo to commit in:

- `-C <path>` given → that directory (resolved relative to the current
  dir, git-style; e.g. `-C tooling` from a multi-repo workspace root).
- otherwise → the current directory.

`cd` there, then confirm it's the intended repo with
`git rev-parse --show-toplevel`. If it isn't a git repo with a recognised
toolchain (e.g. you're at a multi-repo workspace root with no
`package.json` / `pyproject.toml`), **stop and ask which repo** — never
guess. Every step below runs in this repo.

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
that should ship together, make **multiple commits** (repeat steps 2–6
per batch) rather than lumping unrelated work into one commit.

## 4. Review the staged changes

Before showing the diff for approval, run the **house review agents over
the staged diff** so findings land alongside the diff, not after the
commit. Scope every agent to the changed files only
(`git diff --staged --name-only`) — never the whole tree. Match by file
type, and skip this step when nothing reviewable changed (e.g. a pure
version bump or a config-only diff):

- **Code** (`.ts` / `.tsx` / `.py`) → `casomoltd:code-review` — it
  applies the `typescript` standard to `.ts`/`.tsx` and the
  `python-style` standard to `.py` (it picks the rubric by extension, so
  a Python-only repo like `ops` is reviewed just as fully) — plus the
  built-in `/code-review` for correctness bugs on any changed code.
- **Reader-facing prose** — JSX text, headings and FAQ strings in page
  `.tsx`, `.md`, and `meta` titles/descriptions → the prose reviewer
  (`copy-review`) **if it's available**. It owns voice, banned words and
  citations, so no separate banned-word check is needed.
- **`.tsx` / CSS** → `frontend-review`, once that agent exists.

These agents are read-only and diff-scoped by design; run the relevant
ones concurrently (one message, multiple invocations). Their findings are
advisory input to the approval gate below — not a hard block.

## 5. Show the diff and wait for confirmation

Run `git diff --staged` and present it **together with the review
findings from step 4**, grouped by file. Offer to fix anything flagged
before committing. **Stop and wait for the user's explicit confirmation
that they're happy** — never commit off your own judgement. Do not proceed
until the user confirms.

This gate is **enforced, not advisory**: the `git-commit-confirm` guard hook
surfaces a confirmation on every `git commit`, so a commit can't slip through
unconfirmed. Don't try to work around it — the staged tree waiting on the
user's "yes" is the intended resting state.

## 6. Commit

- **Header:** ≤ 50 chars, imperative mood.
- **Body** (optional): wrap at 72 chars, explain *why*.
- **No AI attribution** — no "Co-Authored-By" / "Generated with …" lines.
- **Issue reference:** if an issue number is already in context, add a
  `Closes #<n>` / `Refs #<n>` footer; don't prompt for one otherwise.

**Draft to a file and pre-flight it — never present a doomed commit.**
Write the message to a temp file (Write tool, scratch dir; avoids every
shell-quoting hazard), then run the repo's own `commit-msg` gate on it
and fix exactly what it flags until it passes:

```bash
hook="$(git rev-parse --path-format=absolute --git-path hooks)/commit-msg"
[ ! -x "$hook" ] || "$hook" <msgfile>
```

Only then run `git commit -F <msgfile>`. Don't hand-count character
limits — the gate counts them; a draft that passes here cannot bounce
at commit time, so the user is never asked to confirm a commit that
the hooks would reject.

Run the pre-flight and staging as their own separate commands, and run
`git commit -F <msgfile>` **alone, never inside a compound command** —
the `git-commit-confirm` dialog keys on the whole Bash call, so
bundling makes the user approve drafting/linting/staging along with
the commit. One guarded action per command.

Use a quoted message from the arguments if given. Running `git commit` surfaces
the `git-commit-confirm` guard hook's dialog — that's the enforced form of the
step-5 gate; confirm it, never suppress or bypass it.

## 7. Stop — do not bump, do not push

The version bump and push are **not** part of committing. After the
commit, report the local state and hand off: the release tail lives in
`release-version`, and pushing happens only on an explicit request.

## Boundaries

- **vs `release-version`** — that skill owns the release tail (bump → push →
  publish/deploy); this one never bumps, tags, or pushes. The clean tree is the
  seam: `commit` leaves the tree clean, `release-version` picks up from there.
- **vs the built-in `/code-review`** — step 4 delegates correctness-bug review to
  it and house-standard design review to `casomoltd:code-review`; this skill
  orchestrates the gate, it doesn't re-implement the review.

## Error recovery

Never use destructive git commands to "fix" a mistake — no
`git reset --hard`, `git push --force`, or history rewrites. Clean
history is worth more than a tidy-looking sequence.

- **Pre-commit hook fails after staging:** fix the issue and make a
  **new** commit — never amend a commit that has been shared.
- **Wrong files staged:** unstage with `git restore --staged <file>` and
  re-stage correctly; don't force anything.
