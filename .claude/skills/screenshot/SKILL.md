---
name: screenshot
description: >-
  Capture a screenshot of the running dev server and
  analyse the result. Use when verifying visual changes,
  checking a page renders correctly, or comparing against
  a reference image or design description.
user-invocable: true
argument-hint: "[route] [--preset mobile|tablet|desktop]"
allowed-tools:
  - Bash(npm run ss *)
  - Read
---

# Screenshot skill

Capture a page from the running dev server, read the
image, and describe what rendered.

## Viewport presets

| Preset    | Size       | Use case         |
|-----------|------------|------------------|
| `mobile`  | 390 × 844  | Phone (iPhone)   |
| `tablet`  | 768 × 1024 | Tablet (iPad)    |
| `desktop` | 1280 × 800 | Laptop (default) |

Pass `--preset <name>` or raw `--width`/`--height` flags.
When no preset or dimensions are given the default is
desktop (1280 × 800).

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
