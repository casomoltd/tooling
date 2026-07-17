// footer.typ — the running page footer: brand mark, legal line, page X / N,
// separated from the body by a hairline rule.
#import "tokens.typ": sans-font, company-name, company-registration, hairline
#import "mark.typ": casomo-mark

#let report-footer(year) = context {
  set text(size: 9pt, font: sans-font)
  line(length: 100%, stroke: hairline)
  v(8pt)
  grid(
    columns: (20pt, 1fr, auto),
    column-gutter: 8pt,
    align: (horizon, horizon, horizon),
    casomo-mark(),
    [#sym.copyright #year #company-name, #company-registration],
    [#counter(page).display() / #counter(page).final().first()],
  )
}
