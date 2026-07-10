---
name: page-design
description: The house standard for how a content or explainer PAGE is structured for trust and clarity — the answer above the fold, progressive disclosure, one representation per fact, typographic measure, a single spacing scale, palette-only colour, one primary interactive element per viewport, and visible not-advice framing on pages that show figures. Use when building or reviewing a content / hub / spoke / explainer page, or load it as the rubric a page-design reviewer preloads. Owns page STRUCTURE and information design; sibling to frontend-design, which owns visual art-direction. NOT on-page SEO (does the page answer its target query), NOT prose voice, NOT the mechanical meta/JSON-LD checks, and NOT the concrete brand tokens (those bind per site).
license: Complete terms in LICENSE.txt
---

## Intent

Govern the information architecture and structural design-craft of a content
page — so a reader gets the answer immediately, can reach the depth without being
buried in it, and trusts what they read.

## Applies-to

Rendered content pages — hubs, spokes, explainers, articles, calculators — in any
web stack. Invoked directly when building such a page, or preloaded as the rubric
by a page-design review agent. It governs the *page*, not arbitrary app UI.

## Owns-vs-defers

Owns **page structure + information design**: the above-the-fold answer,
progressive disclosure, one-representation-per-fact, typographic measure + spacing
rhythm, palette discipline (no custom colours), one-primary-interactive-per-
viewport, descriptive-anchor placement, source-citation *presence*, and the
visible not-advice framing.

Defers:

- **reading age / grade level** → a readability gate (a checker, not this rubric);
- **on-page SEO** — does the page answer its target *query*, keyword targeting,
  intent match → an SEO reviewer;
- **prose voice, tone, and citation wording** → a copy reviewer;
- **mechanical structure** — title / meta / H1 / canonical / JSON-LD / alt → a
  meta checker;
- **visual art-direction** — font personality, motion, bold aesthetic direction →
  `frontend-design`;
- **the concrete brand tokens/values** (the palette, the scale, the component
  inventory) → the site's own token source of truth + its per-site binding. This
  rubric names the *rules*, never the hex.

The seam that matters: **`frontend-design` makes a page distinctive; `page-design`
makes it legible and trustworthy.** A restraint-driven explainer wants this rubric
in the lead and `frontend-design` on a short leash.

## The rubric

Each rule is written as construction guidance, with a **Check** a reviewer can
apply. Provenance in parentheses.

### Governing principles

1. **Answer above the fold.** The number, the calculator, or a one-sentence direct
   answer to the page's primary question appears in the first viewport; depth comes
   after. (GDS)
   **Check:** the answer block is the first substantial content after the page
   header — not below a tall hero or an intro explaining the topic's importance.

2. **Progressive disclosure.** Methodology, assumptions, and full tables live
   behind expanders ("how we worked this out"). Depth is available, never
   mandatory. (NN/g)
   **Check:** the deep material is reachable but collapsed; the reader is never
   forced to scroll past it to reach the answer.

3. **One representation per fact.** A figure appears as a widget *or* a table *or*
   prose — never two of them saying the same thing on one page. (NN/g)
   **Check:** no headline figure is repeated across a widget, a table row, and a
   sentence; pick the single form that serves the intent.

4. **Borrow behaviour, never identity.** Adopt the *structure and behaviour* of an
   authoritative design system where it helps a reader (callout patterns,
   plain-language IA, disclosure) — but never its *visual identity*. Keep your own
   palette, type, and radii. (three-layer rule)
   **Check:** no colour, font, or chrome that would make the page read as produced
   by the institution whose structure you borrowed.

### Typography & spacing

5. **Measure 45–90 characters, target ~66.** Body text is not full-bleed.
   (Butterick)
   **Check:** the prose container caps line length; a wide viewport does not run
   body text past ~90 characters.

6. **Readable body.** Body line-height 1.4–1.5; body size ≥16px. (Butterick)
   **Check:** the body type tokens meet these floors.

7. **One spacing scale.** Spacing comes from a single scale, no ad-hoc values; a
   section gap is visibly larger than an intra-section gap. (GDS rhythm)
   **Check:** no one-off margins/padding off the scale; the vertical rhythm
   separates sections from their contents.

8. **Skimmable headings.** H2s are descriptive — reading the H2s alone should
   summarise the page. (GDS)
   **Check:** the H2 outline reads as a summary, not as generic labels.

### Colour & blocks

9. **Palette only — no custom colours.** Every colour comes from the brand palette
   / semantic tokens; zero hardcoded colour values on a page. This is the
   load-bearing rule — it is what makes contrast free.
   **Check:** no raw hex or off-palette colour in the page source.

10. **Contrast is AA by construction.** Rather than checking contrast per page,
    audit the palette's token pairs to WCAG AA *once*; rule 9 then guarantees every
    page inherits AA. (WCAG)
    **Check:** the palette is AA-audited, and the page introduces no custom colour
    that could escape it.

11. **Function borrowed, styling native.** Callout, warning, and inset patterns may
    mirror an authoritative system's *function* — but render in your own visual
    language. (see rule 4)
    **Check:** the pattern's behaviour is familiar; its look is yours.

### Flow & density

12. **Plain language.** Short sentences, one idea per paragraph, aimed at a wide
    reading age. The grade-level *measurement* is a checker's job (deferred); the
    rule here is the writing discipline. (NHS content guide)

13. **One primary interactive element per viewport.** No competing calculators or
    CTAs in the same scroll position — one clear action per screen.
    **Check:** each viewport has a single obvious primary action.

14. **No preamble.** The first paragraph addresses the question, not the topic's
    importance. Cut rule: if a sentence survives deletion without loss, delete it.
    (GDS)
    **Check:** the opening answers; nothing warms up to the topic.

### Word count

15. **No target.** Comprehensive on the question, nothing else. Length is an
    output, not an input — never pad to a number, never trim below completeness.

### Links

16. **Descriptive anchors only.** Never "click here" / "read more"; the anchor text
    says where it goes.
    **Check:** every anchor is meaningful out of context.

17. **Cite every figure.** Each figure carries a link to its primary external
    source. (E-E-A-T)
    **Check:** no unsourced number.

18. **Cluster related links.** Internal links serve the topical cluster; related
    links sit at section ends, not dense mid-sentence. (NN/g)
    **Check:** related links are grouped, not scattered through prose.

### Regulatory framing

19. **Not-advice framing, visibly.** On every page that shows figures, an
    illustrative-not-advice framing is visibly present, and there are no verdicts or
    recommendations anywhere — including microcopy. Link to the site's own
    regulatory-posture statement rather than restating it. (non-negotiable)
    **Check:** the framing renders on the page; no "the best option is…" language.

## Guardrails

- **Never restate the brand tokens here.** This rubric owns the *rules*; the hex,
  the scale, and the component inventory live in the site's own token source and
  its per-site binding. Naming a value here creates a second owner that drifts.
- **Never impose art-direction.** Distinctiveness is `frontend-design`'s call; do
  not push a bold aesthetic onto a restraint-driven explainer to satisfy this
  rubric.
- **Never re-flag a deferred concern** — reading grade, SEO query-fit, prose voice,
  mechanical meta. Name the owner instead.

## Boundaries

- **vs `frontend-design`** — that owns aesthetic art-direction (font personality,
  motion, bold direction); this owns page structure + information design. A content
  page wants both, with this in the lead.
- **vs an SEO reviewer** — that judges whether the page answers its target *query*
  (a retrieval concern); this judges whether the answer is *placed and structured*
  for a reader (a layout concern). "Answer above the fold" here is visual placement,
  not the SEO head-query check.
- **vs a copy standard** — that owns prose voice, tone, and citation wording; this
  owns the *presence and placement* of citations and the page's structure.
- **vs a readability gate** — that measures reading grade deterministically; this
  states the plain-language discipline and defers the measurement.
