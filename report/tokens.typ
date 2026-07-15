// tokens.typ — the shared constants every report component reads.

// Faces — checked by bin/build-report.mjs's font preflight; keep in sync.
#let sans-font = "IBM Plex Sans"
#let mono-font = "IBM Plex Mono"

// The whole style runs on three separation weights: a strong rule (table
// headers), a hairline (row separators), and an intent bar (callouts / key
// figures). Anything heavier — boxes, fills, zebra striping — is deliberately
// absent: the house minimal direction, one separation device per element.
#let strong-rule = 1pt + black
#let hairline = 0.5pt + luma(200)
#let intent-bar = 2.5pt + black

// The legal identity, printed by both the footer and the cover.
#let company-name = "Casomo Ltd"
#let company-registration = "Registered in the UK, 15030496"
