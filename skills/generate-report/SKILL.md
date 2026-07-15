---
name: generate-report
description: >-
  Scaffold a new Typst client report from the Casomo house template and/or
  compile a .typ report to PDF with the build-report bin, then verify the
  output renders. Use when asked to create a client report, start a report,
  compile a .typ file, or rebuild a report PDF. NOT for the report's prose
  voice or wording (a private copy skill owns that), NOT for changing the
  house style itself (edit report/casomo-template.typ in tooling as a
  reviewed code change), and NOT for hosting or publishing the PDF.
user-invocable: true
argument-hint: "[file.typ | new report title]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(build-report *)
  - Bash(npx build-report *)
---

# Generate report

## Intent

Produce a client-ready PDF report in the Casomo house style — scaffold the
`.typ` source from the shared template when it doesn't exist yet, compile it
with `build-report`, and verify the PDF actually rendered.

## Scope

**In:** creating a new report source from the house template; compiling an
existing `.typ`; verifying the compiled PDF (pages, fonts, layout features).

**Out:** the report's *wording* (the caller or a copy skill supplies prose —
this skill owns structure and mechanics); restyling the template (that is an
edit to `report/casomo-template.typ` in `tooling`, reviewed like any code
change); publishing, hosting, or emailing the PDF.

## Inputs

- `$ARGUMENTS` — either a path to an existing `.typ` report (compile it) or a
  title/brief for a new one (scaffold it first).
- The house template: `report/casomo-template.typ` in this package. From a
  consumer repo the import path is
  `/node_modules/@casomoltd/tooling/report/casomo-template.typ` (the
  `build-report` bin sets the Typst root so this resolves). Inside the
  `tooling` repo itself, import it relative.
- `report/example.typ` in this package — a lorem-ipsum reference exercising
  every feature the template styles; read it when unsure how to express a
  structure.

## Method

1. **Resolve the source.** If `$ARGUMENTS` names an existing `.typ`, skip to
   step 3. Otherwise scaffold a new one: follow the repo's existing convention
   for where report sources live (look for one before inventing); default to
   `reports/<kebab-name>.typ`.

2. **Scaffold from the template — never re-paste the document setup.** The
   template owns fonts, cover page, footer, and contents; the report file just
   imports and applies it, then writes the body:

   ```typst
   #import "/node_modules/@casomoltd/tooling/report/casomo-template.typ": casomo-report, band

   #show: casomo-report.with(
     kicker: "<CATEGORY>",  // e.g. "Scoping Report", "Delivery Report", "Technical Note"
     title: "<TITLE>",
     // subtitle: "<one-line subtitle>",  // optional
   )

   = Executive summary
   …
   ```

   - `author` / `email` default to the house values — override only if asked.
   - `band(title, note: none)` draws an unnumbered group divider for long
     reports (e.g. Delivery / Advisories / Decisions); numbered `=` sections
     flow through it untouched. Skip it for simple reports.
   - Don't skip heading levels (`=` → `===` numbers as 1.0.1).

3. **Compile** with the bin (never raw `typst compile` — the bin sets the
   compile root, checks the `typst` CLI is present, and warns on missing
   fonts):

   ```bash
   npx build-report reports/<name>.typ            # → $SCRATCH_DIR/reports/<name>.pdf
   npx build-report reports/<name>.typ -o <path>  # explicit output path
   ```

   The PDF is a build artefact — the bin defaults it to the scratch pool
   (`$SCRATCH_DIR/reports/`, else a gitignored `<repo-root>/scratch/reports/`;
   the README's *Report output & `SCRATCH_DIR`* rule). Pass `-o` only when the
   repo deliberately keeps the PDF (e.g. a site's `public/`).

4. **Verify by reading the PDF** (Claude reads PDFs via the Read tool): the
   cover carries kicker/title, the contents resolve, body pages render, and
   nothing overflows. Fix source problems and recompile; a wrong *font* means
   IBM Plex isn't installed — surface the bin's warning rather than patching
   the template.

5. **Report the output path** and any warnings.

## Typst markup reference

`= Heading` / `== Sub` / `=== Sub-sub` · `*bold*` · `_italic_` · `-` bullets ·
`+` ordered · fenced code blocks with language · `#link("url")[text]` ·
labels `<label>` + refs `@label` · `#figure(..., caption: [...])` ·
`#pagebreak()` · em dash `---`, en dash `--`.

## Guardrails

- Never inline document setup (fonts, page geometry, footer, cover) into a
  report — if the template can't express something, that's a template change
  in `tooling`, not a workaround in the report.
- Client report sources belong to the repo that owns the engagement — never
  add one to this public package (its only `.typ` sources are the template
  and the lorem-ipsum example).
- Verify the compiled PDF before declaring done; a clean exit code is not a
  rendered page.

## Boundaries

- **Prose voice / wording** → the caller's copy skill (private); this skill
  owns scaffold + compile + verify, not sentences.
- **House style changes** → edit `report/casomo-template.typ` in `tooling`
  and review like code; never fork the style per-report.
- **Shipping the PDF** (hosting, email, release bundles) → the owning repo's
  release flow.
