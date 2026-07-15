// cover.typ — the cover page: kicker over the title, the author block, and
// the brand badge with the legal line. Suppresses the running footer.
#import "tokens.typ": sans-font, company-name, company-registration
#import "mark.typ": casomo-mark

#let cover-page(kicker, title, subtitle, author, email, year) = page(footer: [])[
  #set text(font: sans-font)

  #v(1fr)

  #text(size: 12pt, fill: luma(100))[#kicker]
  #v(8pt)
  #text(size: 28pt, weight: "bold")[#title]
  #if subtitle != none {
    v(10pt)
    text(size: 12pt, fill: luma(100))[#subtitle]
  }

  #v(24pt)
  #text(size: 11pt, fill: luma(80))[
    Author: #author \
    Email: #link("mailto:" + email)[#email] \
    Prepared on #datetime.today().display("[day] [month repr:long] [year]")
  ]

  #v(1fr)

  #grid(
    columns: (28pt, 1fr),
    column-gutter: 12pt,
    align: (horizon, horizon),
    casomo-mark(size: 28pt, arrow: 20pt, radius: 5pt),
    text(size: 10pt)[
      #sym.copyright #year #company-name \
      #company-registration
    ],
  )
]
