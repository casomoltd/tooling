---
name: screenshot
description: >-
  Capture a screenshot of the running dev server and
  analyse the result. Use when verifying visual changes,
  checking a page renders correctly, or comparing against
  a reference image or design description.
user-invocable: true
argument-hint: "[route] [--preset mobile|tablet|desktop] [--url <base>]"
allowed-tools:
  - Bash(npm run ss *)
  - Bash(SCREENSHOT_URL=* *)
  - Bash(cd *)
  - Read
---

# Screenshot skill

## Intent

Capture a page from the running dev server, read the image, and describe what
rendered — a visual-verification helper, not a code change.

## Target page

The tool captures a **URL**, not a repo — it never reads
the project it points at. So run it from wherever the
screenshot tooling is installed, and aim it with:

- `SCREENSHOT_URL` — base URL to capture. Defaults to
  `http://localhost:3000`.
- `SCREENSHOT_DIR` — where the PNGs land. Defaults to
  `<cwd>/.claude/screenshots`.

In a multi-repo workspace the tooling is normally installed
**once at the workspace root** rather than in each product
repo, so run `npm run ss` there and set `SCREENSHOT_URL` if
the app under test is not on port 3000. A repo that
installs it locally can still just run `npm run ss` in
place.

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

`playwright` and its Chromium build must be installed
wherever you run the tool — `@casomoltd/tooling` does not
declare a browser, so nothing installs one for you. If the
bin reports playwright missing, tell the user to run
`npm i -D playwright && npx playwright install chromium`
there and stop; do not install it yourself.

The dev server **must already be running** — never start
one yourself (`npm run dev`, `npx next dev`, etc.).
Before taking a screenshot, verify the server is up:

```bash
lsof -ti:3000
```

If nothing is returned, tell the user to start their dev
server and stop.

## Known limitation: client-only components

The screenshot tool uses Playwright with
`waitUntil: "networkidle"`, which fires when there are
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

2. **Read the image** — use `Read` on `latest.png` in the
   output directory (`SCREENSHOT_DIR`, else
   `.claude/screenshots/`). Claude is multimodal and can
   view images via the Read tool.

3. **Describe what rendered** — summarise layout, content,
   colours, and anything visually notable.

4. **Compare if a reference exists** — if there is a
   previous screenshot or the user provided a design
   description / reference image, compare against it and
   call out differences.
