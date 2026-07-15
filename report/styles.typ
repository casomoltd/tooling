// styles.typ — the document-wide type rules: base faces, paragraph rhythm,
// the heading scale (including how a band() divider renders), list spacing,
// link/ref colour, and figure captions. Table rules live in table.typ.
#import "tokens.typ": sans-font, mono-font

#let document-styles(body) = {
  // Faces — tokens.typ owns the names; build-report.mjs preflights them.
  set text(font: sans-font, size: 11.5pt)
  set par(justify: true, leading: 0.95em)
  set heading(numbering: "1.1")
  show raw: set text(font: mono-font)

  // Lists: a broader marker and a clear gap between items, so multi-line
  // bullet items read as distinct points rather than blending into one block.
  // The inter-item spacing is deliberately wider than the in-item leading.
  set list(marker: text(size: 1.15em, fill: luma(55))[•], spacing: 1.15em)
  set enum(spacing: 1.15em)

  // Numbered headings get a size by level; an unnumbered level-1 heading is a
  // band() group divider (components.typ), rendered as a smallcaps label with
  // a rule across the page. Reports that never call band() only ever hit the
  // numbered branch.
  show heading: it => {
    if it.numbering == none {
      block(above: 1.6em, below: 0.7em, width: 100%, breakable: false)[
        #set text(size: 14pt, weight: "bold", fill: luma(70))
        #grid(
          columns: (auto, 1fr),
          align: (left + horizon, horizon),
          column-gutter: 10pt,
          smallcaps(it.body),
          line(length: 100%, stroke: 0.6pt + luma(180)),
        )
      ]
    } else {
      let size = if it.level == 1 { 16pt } else if it.level == 2 { 13pt } else { 11pt }
      set text(size: size)
      it
    }
  }
  show outline.entry.where(level: 1): it => {
    if it.element.numbering == none {
      v(11pt, weak: true)
      strong(smallcaps(it.element.body))
    } else {
      it
    }
  }
  show link: set text(fill: rgb("#0000cc"))
  show ref: set text(fill: rgb("#0000cc"))
  show figure.caption: set text(size: 9.5pt, style: "italic", fill: luma(110))
  show figure.caption: set par(justify: true)
  show figure.caption: set align(left)

  body
}
