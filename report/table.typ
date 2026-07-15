// table.typ — flat table rules: a strong rule under the header row, hairlines
// between body rows, no vertical strokes, no outer box, no zebra, no fills.
// The first row is styled as the header, so open every table with
// table.header(). Right-align numeric columns via the table's `align` and set
// the cells with num().
#import "tokens.typ": strong-rule, hairline

#let table-styles(body) = {
  set table(
    stroke: (x, y) => if y == 0 { (bottom: strong-rule) } else { (bottom: hairline) },
    inset: (x: 10pt, y: 7pt),
  )
  show table.cell.where(y: 0): set text(weight: 600, size: 10pt)
  // Body-par justification stretches badly in narrow cells — tables rag right.
  show table.cell: set par(justify: false)
  body
}
