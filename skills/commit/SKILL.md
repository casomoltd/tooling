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
  - Bash(npm --prefix * run check)
  - Bash(uv run *)
  - Bash(git *)
  - Bash(cd * && git *)
---

# Commit Workflow

Run checks, then commit. Follow these steps in order; do NOT skip or reorder. This skill **commits only** — it does not bump the version or push. The release tail (bump → push → publish/deploy) is a separate, deliberate step ([`release-version`](../release-version/SKILL.md)). Why each step is there, the one commit command and which gate checks what: [Commits](../../docs/commit.md).

## Intent

Take a dirty working tree to a clean, reviewed, conventional commit — stage and review first, then commit **only after the user confirms** — and stop there. One job: commit, behind an explicit confirmation gate. Not bump, not push.

## 0. Resolve the target repo

Decide which repo to commit in:

- `-C <path>` given (the skill's argument, not git's) → that directory (resolved relative to the current dir; e.g. `-C tooling` from a multi-repo workspace root).
- otherwise → the current directory.

Confirm it's the intended repo and take its absolute path with `cd <path> && git rev-parse --show-toplevel`. If it isn't a git repo with a recognised toolchain (e.g. you're at a multi-repo workspace root with no `package.json` / `pyproject.toml`), **stop and ask which repo** — never guess. `<repo>` below is that absolute path. Every git command runs as `cd <repo> && git …` ([why](../../docs/commit.md#the-command)).

## 1. Run checks

Pick the command by toolchain, detected from the repo root:

- **npm repo** (`package.json` with a `check` script): `npm --prefix <repo> run check`
- **Python/uv repo** (`pyproject.toml`): run the strict suite directly, each as `uv run --directory <repo> …`, e.g. `ruff check`, `ruff format --check`, `pyright` and `pytest`

**Detect on the `check` script, not on `package.json` existing.** A non-npm repo may carry a [dev-only `package.json` with no `check`](../../README.md#a-repo-whose-toolchain-is-not-npm), and running `npm run check` there fails with "missing script".

If checks fail, fix the issues and re-run until they pass. Do NOT proceed until they pass.

If a house gate is missing from the repo, wire the shared one, never a local equivalent: [Wire a missing gate, never rewrite it](../../docs/quality-gates.md#wire-a-missing-gate-never-rewrite-it). Fix what a check finds rather than weakening it: [Fix issues, don't disable checks](../../docs/quality-gates.md#fix-issues-dont-disable-checks).

## 2. Stage changed files

Stage files explicitly by name, `cd <repo> && git add <file>…`. **Never** `git add -A` or `git add .`. Review with `cd <repo> && git diff --stat` first.

## 3. Check for remaining unstaged changes

After staging, run `cd <repo> && git diff --stat` again. If what remains is unrelated to what is staged, commit it separately (repeat steps 2–6 per batch) rather than lumping unrelated work into one commit.

## 4. Review the staged changes

Before showing the diff for approval, run the **house review agents over the staged diff** so findings land alongside the diff, not after the commit. Scope every agent to the changed files only (`cd <repo> && git diff --staged --name-only`) — never the whole tree. Match by file type, and skip this step when nothing reviewable changed (e.g. a pure version bump or a config-only diff):

- **Code** (`.ts` / `.tsx` / `.py`) → `casomoltd:code-review` — it applies the `typescript` standard to `.ts`/`.tsx` and the `python-style` standard to `.py` (it picks the rubric by extension, so a Python-only repo is reviewed just as fully) — plus the built-in `/code-review` for correctness bugs on any changed code.
- **Skills and agent briefs** (`**/SKILL.md`, `agents/*.md`) → `casomoltd:skill-review` — it applies the `docs-style` standard and the authoring schema, and closes with an explicit history sweep.
- **Repository docs** (`README.md`, `CLAUDE.md`, `docs/**/*.md`) → `casomoltd:doc-review` — it applies the `docs-style` standard to one doc's shape.
- **Reader-facing prose** — JSX text, headings and FAQ strings in page `.tsx`, page content `.md`, and `meta` titles/descriptions → the repo's prose reviewer, if it has one; this plugin ships none, so skip the route where there is no such agent.

These agents are read-only and diff-scoped by design; run the relevant ones concurrently (one message, multiple invocations). Their findings are advisory input to the approval gate below — not a hard block.

## 5. Show the diff and wait for confirmation

Run `cd <repo> && git diff --staged` and present it **together with the review findings from step 4**, grouped by file. Offer to fix anything flagged before committing. **Stop and wait for the user's explicit confirmation that they're happy** — never commit off your own judgement. Do not proceed until the user confirms.

The staged tree waiting on the user's "yes" is the intended resting state; the commit itself then raises its own confirmation prompt (step 6).

## 6. Commit

- **Header:** imperative mood. **Body** (optional): explain *why*.
- **No AI attribution** lines; the gate refuses them.
- **Issue reference:** if an issue number is already in context, add a `Closes #<n>` / `Refs #<n>` footer; don't prompt for one otherwise.

1. **Write the message to a file** with the Write tool, in a scratch directory (a quoted message from the arguments goes in the file as given).
2. **Run the repo's `commit-msg` gate on it** and fix exactly what it flags until it passes; don't hand-count the limits, the gate counts them:

   ```bash
   hook="$(cd <repo> && git rev-parse --path-format=absolute --git-path hooks)"
   [ ! -x "$hook/commit-msg" ] || "$hook/commit-msg" <absolute message file>
   ```

3. **Commit in [the commit form](../../docs/commit.md#the-command), not chained with another step,** so the confirmation prompt shows the repo, the staged files and the message:

   ```bash
   cd <repo> && git commit -F <absolute message file>
   ```

   Confirm its prompt; never suppress or bypass it.

## 7. Stop — do not bump, do not push

The version bump and push are **not** part of committing. After the commit, report the local state and hand off: the release tail lives in [`release-version`](../release-version/SKILL.md), and pushing happens only on an explicit request.

## Boundaries

- **vs [`release-version`](../release-version/SKILL.md)** — that skill owns the release tail (bump → push → publish/deploy); this one never bumps, tags, or pushes. The clean tree is the seam: `commit` leaves the tree clean, `release-version` picks up from there.
- **vs the built-in `/code-review`** — step 4 delegates correctness-bug review to it and house-standard design review to `casomoltd:code-review`; this skill orchestrates the gate, it doesn't re-implement the review.

## Error recovery

Never use destructive git commands to "fix" a mistake — no `git reset --hard`, `git push --force`, or history rewrites. Clean history is worth more than a tidy-looking sequence.

- **Pre-commit hook fails after staging:** fix the issue and make a **new** commit — never amend a commit that has been shared.
- **Wrong files staged:** unstage with `cd <repo> && git restore --staged <file>` and re-stage correctly; don't force anything.
