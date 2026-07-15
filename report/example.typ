// example.typ — lorem-ipsum reference report for the Casomo house template.
//
// Exercises every structural feature the template styles (cover, contents,
// band dividers, numbered headings to depth 3, lists, flat tables with mono
// numerals, callouts, key figures, code, figures, links, cross-references)
// so a single compile verifies the whole style.
//
//   build-report report/example.typ

#import "casomo-template.typ": casomo-report, band, callout, keyfig, num

#show: casomo-report.with(
  kicker: "Example Report — Template Reference",
  title: "Lorem Ipsum Dolor Sit Amet",
  subtitle: "A placeholder report exercising every feature of the Casomo house style.",
)

= Executive summary

#lorem(60)

- *First finding* — #lorem(18)
- *Second finding* — #lorem(22)
- *Third finding* — #lorem(15)

#keyfig("£30,639", [Lorem ipsum dolor sit amet — the headline metric, lifted.])

#callout(label: "Note:")[#lorem(28)]

#band("Part One", note: "Band dividers group sections without disturbing numbering.")

= Background

#lorem(70)

== Prior work

#lorem(45) See @approach for how this shaped the approach, or the
#link("https://www.casomoltd.com")[Casomo website] for context.

== Constraints

+ #lorem(14)
+ #lorem(16)
+ #lorem(12)

= Approach <approach>

#lorem(50)

== Method detail

#lorem(30)

```ts
export function loremIpsum(dolor: string): string {
  return `sit amet, ${dolor} adipiscing elit`;
}
```

#band("Part Two")

= Results

#lorem(40)

#figure(
  table(
    columns: (auto, 1fr, auto, auto),
    align: (left, left, right, right),
    table.header([Item], [Description], [Annual], [Monthly]),
    [Alpha], [#lorem(8)], num[£29,970], num[£2,497.50],
    [Beta], [#lorem(9)], num[£31,876], num[£2,656.33],
    [Gamma], [#lorem(7)], num[£36,483], num[£3,040.25],
  ),
  caption: [#lorem(16)],
) <results-table>

#lorem(35) The headline figures sit in @results-table.

#callout(label: "Warning:")[#lorem(20)]

= Recommendations

#lorem(30)

- #lorem(20)
- #lorem(17)
