// mark.typ — the brand mark: the white arrow clipped in a black rounded
// square. One definition renders both placements (footer small, cover large).
// The SVG path resolves relative to this file, so both stay in report/.
#let casomo-mark(size: 20pt, arrow: 14pt, radius: 4pt) = box(
  width: size,
  height: size,
  radius: radius,
  fill: black,
  clip: true,
  align(center + horizon)[
    #image("casomo-arrow-white.svg", width: arrow)
  ],
)
