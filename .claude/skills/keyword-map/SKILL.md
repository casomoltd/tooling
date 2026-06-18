---
name: keyword-map
description: Use this skill to audit the whole Casomo site for keyword ownership and cannibalisation — portfolio-level analysis across many pages, not authoring one page. Trigger whenever the user wants to build or refresh the keyword-to-URL map, decide which single page should own a given search term, find or resolve cannibalisation (two Casomo URLs competing for one query), run an SEO content audit, or reconcile the Pages database's target keywords against what pages actually rank for. Also trigger on phrasing like "who should own this term", "are we cannibalising", "audit the pages", "what is each page targeting", "what's a term worth", or "update the keyword map" — even when "skill" or "audit" is never said. This skill reads many pages plus their ranking data and ends in two artefacts: a keyword map and a deduplication list. For optimising a SINGLE page's on-page elements (title, meta, headings, schema, internal links), use the `seo` skill instead — this skill assigns the target term; `seo` optimises the page to it.
---

# Keyword Map & Cannibalisation Audit

**Scope:** hub-site (casomo.co.uk) only. Lives in the shared `tooling` config because skills are discovered from the workspace root, not per repo.

This skill maintains Casomo's **keyword-to-URL map**: the assignment of every target search term to exactly one owning page. The map is the operational form of one rule — **one query, one owner** — and the audit is how that rule gets enforced against a live site that drifts.

It produces two artefacts:

1. **The keyword map** — every owned term, its single owning URL, intent, value (volume, KD), and current rank.
2. **The deduplication list** — every place two Casomo URLs compete for one query, with a recommended fix.

The map lives in the **Pages database** in Notion (project memory). This skill proposes changes to it but **never writes without approval** — see [The approval gate](#the-approval-gate), which is the most important rule here.

## Why this skill exists

Casomo's `seo` skill optimises one page at a time and states the rule "one primary keyword per page, don't cannibalise" — but a per-page authoring skill has no way to *check* that rule, because cannibalisation only shows up across the whole portfolio. This skill is that missing cross-site check. The two are sequential: this skill decides which page owns a term; `seo` then optimises that page to it. The "Target query confirmed" item at the top of the `seo` checklist is this skill's output handed forward.

## The two questions to keep separate

Most cannibalisation confusion comes from conflating these. Keep them apart at every step:

- **What does a page rank for *now*?** — empirical. Comes from GSC and Ahrefs. Ground truth, not opinion.
- **What *should* a page own?** — editorial. A judgement about intent, value, and which page is the best home. This is the assignment, and it is made deliberately — never inferred from keyword frequency or handed to a tool to guess.

Cannibalisation is a *second-question* failure: pages overlap because nobody assigned ownership. The data informs the assignment; it does not make it.

## Tools and inputs

- **Pages database (Notion).** The page inventory and the map's home; its IDs, schema, and write conventions live in [The Pages database](#the-pages-database). Fetch it first to read the current page list, statuses, slugs, and field values.
- **Google Search Console**, via the Ahrefs MCP `gsc-keywords` on the verified `casomo.co.uk` property. Ground truth for what each URL impresses/ranks for **on Google only** — a large but partial slice of Casomo's organic (the Bing ecosystem is the rest; see below). Treat it as the Google view, not the whole picture. It anonymises sparse low-volume queries (an empty result on a thin term is weak evidence, not proof of nothing) and its keyword/page tables lag roughly two weeks — if a recent window returns empty, widen it.
- **Bing — measure it each run, via PostHog.** Casomo's audience skews to NHS staff on Edge-locked Trust machines, so the Bing ecosystem (Bing + DuckDuckGo + Yahoo, all on Bing's index) is a far larger share of organic here than general market share implies — it can rival Google. Don't assume a figure; **pull the live split each audit**. There is no Bing Webmaster Tools MCP tool, so use PostHog: `$pageview` broken down by `$search_engine` / `$referring_domain`, filtered to `$host = 'casomo.co.uk'` (raw HogQL skips the test-account filter — see `deployment.md`). BWT is verified; check it manually in-app. Why it changes decisions: Bing leans on on-page/exact-match over backlinks, so a well-optimised spoke can win on Bing at low DR — weight ownership and effort with the live split in mind, not a Google-only view.
- **Current crawl/index/redirect state — `hub-site/docs/deployment.md`.** What is `noindex`, the canonical strategy, and which paths redirect all change over time and live there, not in this skill. Read it before assigning calculator/tool intent or flagging duplication. If a finding contradicts it, **update the doc** (append a Change Log row); don't hardcode specific redirects here — they go stale.
- **Ahrefs Site Explorer → Organic keywords**, per URL. Cross-checks GSC and surfaces positions beyond GSC's sampling. Casomo project id `9636646` (verify before use).
- **Ahrefs Keywords Explorer.** Volume + KD for every candidate term — the *value* a term carries, used to decide whether it is worth owning at all.
- **Page content.** Read each page's live content (fetch the URL) to classify its intent and judge what it is genuinely positioned to own. This is the "read the page and work out what it should rank for" step — done by reasoning about intent, not by a keyword-density tool.

## Procedure

Work in this order. Do not write anything to Notion until step 7.

1. **Inventory.** Fetch the Pages database ([schema](#the-pages-database)). List every page with status `Live`, `Drafting`, or `Planned`, with its slug/URL and current field values. Note pages with no `Primary keyword` — they are the gaps — and confirm each slug resolves (a 404 is drift, not an owner).

2. **Pull current rankings, per URL.** For each live page, pull `gsc-keywords` (Google) and Ahrefs organic keywords, **and** the PostHog `$search_engine` split so Bing-driven demand isn't missed (Bing is a major channel for this audience). Record, per page, the terms it ranks for and their positions. This answers question one.

3. **Classify intent and propose an owner term.** Read each page's content. Assign it an intent class (see [Intent classes](#intent-classes-and-ownership-rules)) and propose the one **primary** term it should own, plus 1–2 secondary terms. This answers question two. Respect the ownership rules — especially that the hub owns the head/table intent and spokes own the single-item-deep intent.

4. **Value the terms.** Run Keywords Explorer on every proposed primary and secondary. Apply Casomo's thresholds (inherited from the `seo` skill — do not restate them, read them there: tools vs content volume floors, KD ceiling). A term below the floor is not worth a dedicated owner; fold it into a parent page or drop it.

5. **Detect cannibalisation.** Cross-tabulate. Flag two kinds of conflict:
   - **Live cannibalisation** — more than one Casomo URL ranking in roughly the top 50 for the same term (from step 2).
   - **Planned cannibalisation** — two pages whose *proposed* primary (from step 3) is the same term.
   For each, decide a single winner and a resolution (see [Resolving cannibalisation](#resolving-cannibalisation)).

6. **Assemble the two artefacts.** Build the keyword map and the dedup list in the formats below.

7. **The approval gate.** Present a summary to the user and stop. Do not write to Notion. See [The approval gate](#the-approval-gate).

8. **Write back, once approved.** Apply only what was approved, to the fields described in [The Pages database](#the-pages-database).

## Intent classes and ownership rules

Casomo runs a funnel architecture: every content page hands off to the calculator, and the calculator itself (`/calculator`) is **noindexed**. So tool-intent terms cannot be owned by the tool — they are owned by the content page that best matches the intent and demonstrates the calculator inline.

Assign each page one class, and own terms accordingly:

- **Calculator-intent content** (e.g. the take-home manual page; a pension manual page). Owns tool-intent terms like "nhs take home pay calculator", "nhs pension calculator". These terms have no other valid home because the tool is noindexed. (Confirm which URL is actually indexable before assigning — check the live page's robots meta and canonical, **not** its rankings, since a URL can keep ranking for months after going `noindex` or starting to redirect. Where both the tool and its `/tools/...` route are noindex/redirects, the calculator intent must live on a content page such as the homepage — see `deployment.md` for the current owner.) One such page per distinct tool intent (take-home, pension) — distinct intents, not fragmentation.
- **Bands hub** (the Agenda for Change overview). Owns the *whole-table / head* intent: "nhs pay bands", "agenda for change pay scales", "nhs banding". Must carry the full ladder and link down to every spoke.
- **Bands spoke** (a single band's page). Owns the *single-band-deep* intent: "band 6 nhs pay", "band 6 take home pay", "is band 6 a good salary". Must carry genuinely band-specific content (spot points, roles, HCAS, worked take-home) — a spoke that reprints the hub's row will lose to the hub. The hub must NOT also chase the spoke's term.
- **Senior bands** (8c, 8d, 9) carry near-zero volume. Prefer one combined "Band 8–9 (senior/management)" page over a page each — match page granularity to where demand actually exists, the same discipline applied to spokes.
- **Region** (a single nation's pay page). Owns "nhs [nation] pay" / "[nation] pay bands"; differentiate from the hub's UK-wide head term.
- **Decision / user-story** pages. Own a specific *should-I* query ("going part-time nhs pension", "is salary sacrifice worth it"); calculator-led, one decision per page. Reserve this for genuine choices — a page that merely *explains* a pay/pension topic is a Pay explainer, not a Decision.
- **Pay explainer** / **Pension/explainer**. Informational pages explaining a pay or pension topic (sick pay, maternity, overtime, redundancy, the annual pay award; pension scheme types, McCloud) that funnel to the calculator. Own the "what is / how does X work" query for their topic.
- **Comparison**. Editorial comparing tools/calculators; owns comparison/commercial queries ("best nhs pay calculator").
- **Glossary**. The DefinedTermSet index; owns definitional long-tail.
- **Brand / brochure** (e.g. /about). Owns brand terms and the transformation narrative. The homepage is the exception — it carries the **Calculator-intent** primary (the tool itself is noindexed; see `deployment.md`) with the brand promise in the hero, not a Brand primary.
- **Utility**. Pages with no search target (noindex tools, redirects, /contact, /privacy). No primary — mark with the `—` sentinel (see [The Pages database](#the-pages-database)).

The spine across all classes: **one query, one owner.** If two pages want the same term, one is reassigned or the term is differentiated by intent — never left split.

## Resolving cannibalisation

For each conflict, pick one winner and one fix. In rough order of preference for Casomo:

1. **Differentiate by intent.** Keep both pages; sharpen each to a distinct query (the hub/spoke split is this). Use when both pages serve genuinely different intents.
2. **De-optimise the loser for the term.** Keep both pages; strip the contested term from the weaker one's title/H1/early body so it stops competing. Use when one page should clearly own it and the other only brushes the term.
3. **Consolidate.** Merge the weaker page into the stronger and redirect. Use when the two pages are near-duplicates with no distinct intent.
4. **Canonicalise.** Point the weaker at the stronger with a canonical tag. Use sparingly, when consolidation isn't yet possible.

Record the chosen fix per conflict in the dedup list. Note that fixes 2–3 are page edits — they hand off to the `seo` skill (de-optimise) or to a build task (merge/redirect); this skill recommends, it does not rewrite the page.

## Deliverable formats

**Keyword map** — one row per owned term:

| Term | Owning URL | Intent class | Volume | KD | Current position | Owning URL ranks? |
|------|-----------|--------------|--------|----|--------|-------|

**Deduplication list** — one row per conflict:

| Term | Competing URLs | Winner | Resolution | Hands off to |
|------|---------------|--------|------------|--------------|

Lead the summary with the headline numbers: how many terms now have a clear single owner, how many conflicts were found, how many pages have no worthwhile target and are candidates to drop or merge.

## The approval gate

**Never write to the Pages database without explicit approval.** The database is project memory; an unreviewed write corrupts the single source of truth.

The sequence is always:

1. Present the keyword map, the dedup list, and the exact field changes proposed (per page: what `Primary keyword` / secondary / volume / KD / position would be set to).
2. If the proposal requires new database fields that don't exist yet (see below), say so explicitly and include creating them in what you're asking approval for.
3. Stop. Wait for the user to review and approve — in whole or in part.
4. Apply only what was approved. If approval was partial, apply exactly that and report what was left unwritten.

Frame the summary so it can be checked quickly: the user is reviewing assignments, so make the proposed owner and any reassignments easy to scan, not buried in raw data.

## The Pages database

Database `e535c45bdf324a028db951f82076ed98` (data source `d80e3e79-08f6-4c8b-9855-d2c79ee8189e`), under Search Bench — confirm both IDs resolve on first run. This is the canonical description of the map's home; the inventory (step 1) and write-back (step 8) both point here.

The schema carries the fields that make one-query-one-owner enforceable: `Slug`, `Status`, `Funnels to`, `Related pages`, plus **`Primary keyword`** (text — the single term this page owns; unique across the DB so sorting surfaces every collision), **`Intent class`** (select — the page's role; see [Intent classes](#intent-classes-and-ownership-rules)), **`Volume`**, **`KD`**, and **`Current position`** (numbers, refreshed each audit so drift shows), and **`Low volume`** (checkbox). There is **no** secondary-keyword field — an earlier `Target Keywords` multi-select was removed as the wrong shape (a closed option list can't hold arbitrary terms). If secondaries are ever wanted, add a **free-text** field, never a multi-select.

Conventions:

- **One `Primary keyword` per page.** Don't overwrite a human-set value with an automated guess — surface a disagreement as a proposed change, don't silently replace it.
- **`Primary keyword` distinguishes three states — never leave it truly blank.** A real owned term → the term itself. A page that *should* own a term but it isn't decided yet → **`TBD`** (a visible to-do). A page that should **never** own a term (a `noindex` tool, a redirect, brand/utility) → set `Intent class` to **Utility**/**Brand** and a `—` sentinel (e.g. `— (noindex)`). A truly empty cell reads as "not done yet"; the sentinels make intent explicit.
- **Keep `Volume`/`KD` numeric** so the map sorts by opportunity size — never convert them to text. Where a term carries no measurable search demand, leave the number empty and tick **`Low volume`**; that flags long-tail/funnel pages so an empty number reads as "negligible", not "not fetched".
- **`Related pages` is a one-way relation** — setting hub→spokes does **not** populate spokes→hub. Set both sides explicitly to build the hub↔spoke↔region graph.
- **Verify each `Slug` against the live route before trusting it.** The DB drifts from reality — slugs go stale, routes 404, content moves path. `curl` the URL; if it 404s, the row is mislabelled (fix the slug) or obsolete (mark it `Obsolete`), not a live owner.

(Notion MCP note: programmatic page trashing is broken — issue #258. If the audit recommends deleting a page, flag it for manual deletion rather than attempting it.)

## Relationship to the `seo` skill

- This skill is **portfolio-level and backward-looking**: many pages, ranking data in, a map and dedup list out.
- The `seo` skill is **single-page and forward-looking**: one draft page in, an optimised page out.
- Thresholds (volume floors, KD ceiling) live in the `seo` skill. Read them there; do not duplicate them here.
- Handoff: this skill sets each page's target; `seo` optimises the page to it. A "de-optimise the loser" fix is executed by `seo`, not here.
