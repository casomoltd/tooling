---
name: screenshot
description: >-
  Capture a screenshot of the running dev server and
  analyse the result. Use when verifying visual changes,
  checking a page renders correctly, or comparing against
  a reference image or design description.
user-invocable: true
argument-hint: "[route] [--preset mobile|tablet|desktop] [-C <repo>]"
allowed-tools:
  - Bash(npm run ss *)
  - Bash(cd *)
  - Read
---

# Screenshot skill

## Intent

Capture a page from the running dev server, read the image, and describe what
rendered — a visual-verification helper, not a code change.

## Target app

In a multi-repo workspace, pick the app whose dev server
you're capturing: if `-C <path>` is given, `cd` into it
first (git-style); otherwise use the current directory.
`npm run ss` and the saved screenshot
(`.claude/screenshots/latest.png`) are both relative to
that app.

## Viewport presets

| Preset    | Size       | Use case         |
|-----------|------------|------------------|
| `mobile`  | 390 × 844  | Phone (iPhone)   |
| `tablet`  | 768 × 1024 | Tablet (iPad)    |
| `desktop` | 1280 × 800 | Laptop (default) |

Pass `--preset <name>` or raw `--width`/`--height` flags.
When no preset or dimensions are given the default is
desktop (1280 × 800).

## Prerequisites

The dev server **must already be running** — never start
one yourself (`npm run dev`, `npx next dev`, etc.).
Before taking a screenshot, verify the server is up:

```bash
lsof -ti:3000
```

If nothing is returned, tell the user to start their dev
server and stop.

## Known limitation: client-only components

The screenshot tool uses Puppeteer with
`waitUntil: "networkidle0"`, which fires when there are
no outstanding network requests for 500 ms. It does **not**
wait for React hydration or client-side rendering to
complete. Components that render entirely on the client
(e.g. Recharts charts inside a `'use client'` boundary)
may appear empty, partially rendered, or clipped in
screenshots even though they display correctly in a real
browser.

If a screenshot shows a client-rendered component looking
wrong, **do not chase layout or sizing fixes** — verify
manually in the browser instead.

## Steps

1. **Take the screenshot** — run `npm run ss` with the
   route and any flags from `$ARGUMENTS`.
   Examples:
   - `npm run ss` — root page, desktop
   - `npm run ss contact --preset mobile`
   - `npm run ss --width 1440 --height 900`

2. **Read the image** — use `Read` on
   `.claude/screenshots/latest.png` (Claude is multimodal
   and can view images via the Read tool).

3. **Describe what rendered** — summarise layout, content,
   colours, and anything visually notable.

4. **Compare if a reference exists** — if there is a
   previous screenshot or the user provided a design
   description / reference image, compare against it and
   call out differences.
