// casomo-template.typ — shared house style for Casomo client reports.
//
// The single import point. Internals live in the sibling component files —
// tokens.typ (fonts, rule weights, legal identity) · styles.typ (document
// type rules) · table.typ (flat tables) · components.typ (band, callout,
// keyfig, num) · mark.typ (brand mark) · footer.typ · cover.typ — and this
// file re-exports the author-facing API, so a report needs only:
//
//   #import "casomo-template.typ": casomo-report, band, callout, keyfig, num
//   #show: casomo-report.with(
//     kicker: "Delivery Report & Findings",
//     title: "The Report Title",
//     subtitle: "One-line summary of what was delivered.",  // optional
//   )
//
//   = Executive summary
//   …
//
// Components follow the house minimal direction — flat, hairline dividers,
// one separation device per element — translated to the report's own
// identity: monochrome, IBM Plex. Conventions transfer; the site's palette
// and web faces do not.
//
// Asset paths resolve relative to the file using them, so the report/ files
// stay together as one directory. Importers only need this directory inside
// the compile root (`typst compile --root …` — the `build-report` bin sets
// this). Compile with `build-report <report.typ>`; needs the `typst` CLI
// plus the IBM Plex Sans / IBM Plex Mono fonts installed.

#import "components.typ": band, callout, keyfig, num
#import "styles.typ": document-styles
#import "table.typ": table-styles
#import "footer.typ": report-footer
#import "cover.typ": cover-page

#let casomo-report(
  kicker: none,
  title: none,
  subtitle: none,
  author: "David Mohamad",
  email: "info@casomoltd.com",
  body,
) = {
  // Copyright year tracks the compile date — a report is (re)issued when it is
  // (re)compiled, so the year is never stale.
  let year = datetime.today().display("[year]")

  show: document-styles
  show: table-styles

  set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
    header: none,
    footer: report-footer(year),
  )

  cover-page(kicker, title, subtitle, author, email, year)

  // --- Table of contents ---
  page[
    #outline(title: "Contents", indent: auto, depth: 2)
  ]

  body
}
