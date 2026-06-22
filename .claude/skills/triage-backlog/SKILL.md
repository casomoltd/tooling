---
name: triage-backlog
description: >-
  Triage the Casomo execution backlog file (TODO.md) — route Notion
  Inbox captures into it, verify drift against the repos, prune done
  work, reorder, and keep a dated changelog. NOT for the Notion Idea
  Backlog, PR/issue queues, or generic task lists.
user-invocable: true
argument-hint: "[add \"<item>\"]  (no arg = full triage cycle)"
allowed-tools:
  - Bash(git *)
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Agent
  - mcp__plugin_Notion_notion__notion-fetch
  - mcp__plugin_Notion_notion__notion-search
  - mcp__plugin_Notion_notion__notion-create-pages
  - mcp__plugin_Notion_notion__notion-update-page
---

# Triage the Casomo Backlog

The Casomo dev backlog is **`$WORKSPACE_ROOT/TODO.md`** (the real file
lives at `tooling/TODO.md`, symlinked at the workspace root and
committed in the `tooling` repo). It holds rich, spec-like engineering
items across all repos.

This skill is the repeatable method for two recurring jobs the user does
often: **adding** items to that backlog and **triaging** it.

## The model (why two stores — don't fight it)

The user runs a deliberate Notion **"Life & Work OS"**. Respect its
separation — this backlog is one layer in it, not a replacement:

- **Notion Inbox** = capture only. Raw ideas land here (or are spoken to
  Claude). Routed, then cleared.
- **This backlog file** = the single home for rich dev specs/state.
- **Notion Tasks "Now"** = the 1–3 items actually in flight, as *thin
  pointers* ("short, vague is fine"). Completed tasks disappear.
- **Decisions** → the Casomo **Decisions DB**. **SEO data** → the
  **Pages DB**. Backlog items **link** to these by id — never duplicate
  their content here.

Core principles to honour (the user's own rules): tasks are *actions*,
not decisions or states; **prioritise at review, not at entry**;
deletion is success, but keep a traceable changelog; do not duplicate —
link to the source of truth; if the system creates pressure, simplify.

**Durable method, never point-in-time.** This file encodes *how* to
triage, never the results of any one run. Do not bake counts,
percentages, dates, or specific item states into this skill — every run
reads the current date and re-measures from scratch. See
`[[skills-durable-not-pointintime]]`.

## Quick-add mode — `add "<text>"`

If `$ARGUMENTS` starts with `add`, this is a fast capture: append the
item to the appropriate tier in `TODO.md` as a dated draft, then stop.
Do not run the full cycle. Confirm where it landed. (Use this when the
user just wants something recorded without a triage.)

Otherwise, run the full cycle below.

---

## 0. Locate the backlog and establish the date

Read `$WORKSPACE_ROOT/TODO.md`. Determine **today's date** from the
session environment (never hardcode it) — it stamps any changelog entry
and gates drift checks.

If `WORKSPACE_ROOT` is unset, stop and ask the user to set it.

## 1. Intake — route captures (kills double-entry)

Pull new captures into the backlog so the user only ever captures once:

- `fetch` the Notion **Inbox** page (find it via `notion-search` for
  "Inbox" under the user's Life & Work OS). Identify items that are
  Casomo dev/product work.
- Fold in anything raised in this session and any `add` text.
- Route each into the right tier of `TODO.md` as a draft item (title +
  a line or two of intent; flesh out during triage).
- **List exactly what you routed** so the user can clear those Inbox
  items (per the OS, Inbox is cleared at review — you don't delete it
  for them unless asked).

If Notion is unavailable, say so and continue with session/`add` items
only — never block the triage on it.

## 2. Verify drift (the core triage move)

Backlog items reflect what was true when written and **drift**. For any
item that asserts a state ("not implemented", "thin page", "parked on
branch X", "no FAQ") or is more than a few days old, **verify it against
the actual repos before trusting it**:

- Spawn `Explore` agents (in parallel) to check the concrete claims —
  does the file/redirect/test/page exist now? has the branch merged? is
  the word count/feature still as described?
- Prefer a few focused agents over one broad one; give each a short list
  of checkable claims and ask for `file:line` evidence.

Report what changed since the text was written.

## 3. Triage edits

Using the verification results, edit `TODO.md`:

- **Close** items the evidence shows are done (move them to the
  changelog — step 4).
- **Reword** drifted text so it matches reality (fix stale counts,
  paths, "not built" claims).
- **Reorder** by current priority — remember priority is decided *now*,
  at review, not preserved from entry. Promote/demote across tiers.
- Keep items lean: an item is an action plus the spec needed to do it.
  Move any *decision* to the Decisions DB and any *SEO/keyword data* to
  the Pages DB, leaving a linked reference (id) here, not a copy.

## 4. Maintain the changelog

Append (or update) a dated `## Closed in <today's date> triage` section
at the foot listing what was pruned or downgraded and why (one line
each). This is the audit trail — "deletion is success", but never
silent.

## 5. Finalize — write-out (ONLY after explicit approval)

Edits to the backlog file happen in place during triage. Everything
that writes **outside** the file — Notion changes and the git commit —
is a single **finalize stage that must NOT be actioned until the user
approves it**. First *propose* the whole write-out as a checklist, then
stop and wait:

- **Notion sync:** which active items (≤ 3, within the OS's 3–5 "Now"
  cap) to create as thin Task pointers (Domain = `Company`, Status =
  `Now`, body links back to the backlog); and any genuine architectural/
  product **decision** to log to the Casomo Decisions DB
  (`[[notion-decisions-db]]`). Don't mirror the whole backlog — only
  what's live. Completed pointers are deleted, not marked done.
- **Backlog commit:** the `TODO.md` diff to commit, in its **private**
  repo — **never** the public `tooling` repo — per `/commit`
  conventions (concise message, no AI attribution).

**Wait for explicit approval.** On approval, do the Notion writes and the
local commit; if the user approves only part, do only that. **Never
`git push`** — pushing is always a separate, explicit instruction (see
CLAUDE.md "Pushing").

## Guardrails

- Never duplicate Decisions-DB or Pages-DB content into the backlog —
  link it.
- Never hardcode run-specific numbers into this skill.
- Don't clear the user's Notion Inbox for them unless asked — list what
  to clear.
- Follow the user's working style: make the call and state assumptions,
  be brief, don't re-ask answered questions.
