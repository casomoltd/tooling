// components.typ — the author-facing body components: band dividers, mono
// figures, callouts, and key figures. (How a band heading *renders* lives
// with the other heading rules in styles.typ; this file owns the semantics.)
#import "tokens.typ": mono-font, intent-bar

// Band dividers — unnumbered group headers that organise the contents and the
// body into sections (e.g. Delivery / Advisories / Decisions / Hand-over)
// without numbers and without disturbing the 1..N section numbering. Optional:
// reports that don't want grouped sections simply never call band().
#let band(title, note: none) = {
  heading(level: 1, numbering: none, outlined: true)[#title]
  if note != none {
    text(size: 9.5pt, style: "italic", fill: luma(110))[#note]
    v(0.1em)
  }
}

// Figures set in IBM Plex Mono so numerals read as data and align
// digit-for-digit down a column; labels and prose stay in Plex Sans. Sized
// down slightly to match the sans x-height. Use in numeric table cells and
// for inline figures: num[£29,970].
#let num(value) = text(font: mono-font, size: 0.92em, value)

// A note the reader must not miss — a thick left bar carries the emphasis,
// no box, no fill. `label` bolds the intent: callout(label: "Warning:")[…].
#let callout(body, label: none) = block(
  above: 1.3em,
  below: 1.3em,
  width: 100%,
  stroke: (left: intent-bar),
  inset: (left: 12pt, top: 3pt, bottom: 3pt),
  {
    set text(size: 10pt)
    set par(justify: false)
    if label != none {
      strong(label)
      h(0.4em)
    }
    body
  },
)

// A lifted headline metric — big mono figure over a muted caption, carried
// by the same left bar: keyfig("£30,639", [Band 5, top of scale]).
#let keyfig(value, caption) = block(
  above: 1.4em,
  below: 1.4em,
  stroke: (left: intent-bar),
  inset: (left: 12pt, top: 2pt, bottom: 2pt),
  {
    text(font: mono-font, weight: 700, size: 20pt, value)
    linebreak()
    v(1pt)
    text(size: 9.5pt, fill: luma(110), caption)
  },
)
