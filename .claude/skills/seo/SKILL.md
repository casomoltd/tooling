---
name: seo
description: Use this skill when creating or editing page content that targets organic search, including page titles, meta descriptions, headings, structured data, internal linking, and source citations. Also trigger when the user asks about SEO strategy, keyword targeting, or content structure for search visibility.
---

# SEO Content Rules

**Scope:** hub-site (casomo.co.uk) only. Lives in the shared `tooling` config because skills are discovered from the workspace root, not per repo.

Rules for creating search-optimised content on the
Casomo hub site. These complement the write-copy skill
(voice and tone) with search-specific guidance.

Full checklist: `hub-site/docs/seo-checklist.md`

## On-Page Checklist

Before considering a page done, verify each item:

1. **Target query confirmed.** One primary, optionally
   1-2 secondary. Volume >200/mo (tools) or >500/mo
   (content), KD <10.
2. **URL slug:** short, lowercase, hyphenated, contains
   the core noun phrase of the query.
3. **Title tag:** under 60 chars, primary query near
   front, brand suffix (` | Casomo`) if space.
4. **Meta description:** 140-160 chars, includes primary
   query naturally, sells the click.
5. **H1:** exactly one, contains the primary query or
   close variant, different from the title tag.
6. **First 100 words:** primary query appears naturally;
   the page answers the query in the opening paragraph.
7. **H2 hierarchy:** reflects natural sub-questions;
   secondary queries live in H2s where they fit.
8. **Body copy:** substantive (1,000+ words for content
   pages, parity with competitors otherwise), genuine
   info gain over what's already ranking.
9. **Internal links:** 2-5 outbound with descriptive
   anchor text. Identify 2-3 existing pages that should
   link to this page and add those links.
10. **Structured data:** Article, WebApplication, FAQ,
    or BreadcrumbList as applicable. No fake FAQs.
11. **Canonicals:** self-referencing canonical, Open
    Graph tags, Twitter card, `lang="en-GB"`.
12. **Images:** descriptive filenames, meaningful alt
    text, compressed, lazy-loaded below the fold.
13. **Flag any item you can't satisfy** and explain why.

## Authoritative Sources Only

Link to first-party government and institutional
sources. These strengthen E-E-A-T and signal topical
authority to search engines.

**Preferred sources:**
- healthcareers.nhs.uk (NHS roles, AfC pay rates)
- nhsemployers.org (pay scales, terms and conditions)
- nhsbsa.nhs.uk (pension contribution rates)
- gov.uk / HMRC (tax rates, NI thresholds, pension)
- gov.scot (Scottish NHS pay settlements)
- gov.wales (Welsh NHS pay settlements)
- unison.org.uk, rcn.org.uk (union pay scale
  references, secondary to official sources)

**Never link to competitor sites.** Outbound links pass
PageRank to the target domain. Sites like
nhsbands.co.uk and nhspayband.co.uk are direct
competitors for the same keywords. Citing them helps
them outrank us.

## Internal Linking

Connect hub content into a tight topical cluster:

- Band pages link to AfC overview, pension scheme,
  calculator, and adjacent bands
- Resource pages link to related tools and articles
- Calculator pages link to relevant resources
- Every page should have at least 2 internal links

Use descriptive anchor text that includes the target
keyword naturally. Avoid generic "click here" or
"learn more" anchors.

## Data Source Citations

When a page presents factual data (pay scales, tax
rates, pension tiers), cite the source in a Notes
section with a direct link. This builds trust with
readers and signals accuracy to search engines.

Prefer canonical HTML pages over PDFs where both exist.
PDFs change URLs more often and are harder for readers
to navigate.

## Keyword Targeting

- One primary keyword per page. Don't cannibalise
  across pages targeting the same term.
- Include year-specific variants where relevant
  (e.g. "nhs band 5 pay 2025/26")
- Use the keyword naturally in H1, first paragraph,
  and at least one H2

## Structured Data Extended Rules

Beyond the basics in the on-page checklist:

- **Organization** (homepage): must include `logo`,
  `foundingDate`, `sameAs` (director LinkedIn URLs),
  and `contactPoint`.
- **WebSite** (root layout): present on every page via
  the root layout `<JsonLd>`. Includes `name`, `url`,
  and `publisher`. Add `SearchAction` only when a search
  endpoint exists.
- **WebApplication** (tool pages): calculators and
  interactive tools use `WebApplication` with
  `applicationCategory`, `operatingSystem`, and a free
  `Offer`.
- **DefinedTermSet** (glossaries): glossary index pages
  use `DefinedTermSet`; individual entries use
  `DefinedTerm`.

## Performance / Core Web Vitals

- Add `priority` to every `<Image>` that renders above
  the fold (hero images, author avatars on about pages).
- Add `sizes` to responsive images so the browser can
  pick the right source without layout shift.
- Set immutable cache headers (`Cache-Control: public,
  max-age=31536000, immutable`) for `/assets/` and
  `/screenshots/` in `vercel.json`. Next.js handles
  `_next/static` automatically.
- Prefer AVIF over WebP via `images.formats` in
  `next.config.ts`. ~80 % of browsers get smaller AVIF;
  the rest fall back to WebP.
- Do not defer CSS for Material Symbols or flag-icons —
  they load on nearly every page and deferring causes
  icon flash.

## Internal Linking — Structural Rules

In addition to the per-page guidance above:

- The **homepage** must link to the content cluster:
  Agenda for Change overview, glossary, and articles
  index (via a "Start here" section).
- The **footer** must include a link to the calculator
  so every page has a path to the primary tool.
- Band pages, resource pages, and article pages should
  cross-link within their cluster as described in the
  Internal Linking section above.
