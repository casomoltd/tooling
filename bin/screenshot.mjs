#!/usr/bin/env node

/**
 * Capture a screenshot of the running dev server.
 *
 * Usage:
 *   npm run ss [page] [--width <n>] [--height <n>]
 *
 * Arguments:
 *   page  Optional path segment appended to the base URL. Also used as the
 *         filename prefix. Defaults to "base" (captures the root page).
 *
 * Options:
 *   --width <n>   Viewport width in pixels (default: 1280)
 *   --height <n>  Viewport height in pixels (default: 800)
 *
 * Examples:
 *   npm run ss                          # 1280×800 desktop capture
 *   npm run ss -- --width 390 --height 844  # iPhone-sized capture
 *   npm run ss contact --width 390      # mobile capture of /contact
 *
 * Environment:
 *   SCREENSHOT_URL  Base URL to capture (default: http://localhost:3000)
 *
 * Output:
 *   .claude/screenshots/{page}-{timestamp}.png  Timestamped capture
 *   .claude/screenshots/latest.png              Always the most recent capture
 */

import { parseArgs } from "node:util";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL =
  process.env.SCREENSHOT_URL || "http://localhost:3000";
const OUTPUT_DIR = path.join(
  process.cwd(),
  ".claude",
  "screenshots",
);

const { values, positionals } = parseArgs({
  options: {
    width: { type: "string", default: "1280" },
    height: { type: "string", default: "800" },
  },
  allowPositionals: true,
});

async function screenshot() {
  const pageName = positionals[0] || "base";
  const width = Number(values.width);
  const height = Number(values.height);
  const safePrefix = pageName.replace(/\//g, "-");
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const filename = `${safePrefix}-${timestamp}.png`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const url =
      pageName === "base"
        ? BASE_URL
        : `${BASE_URL}/${pageName}`;
    console.log(`Navigating to ${url}...`);

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const filepath = path.join(OUTPUT_DIR, filename);
    const latestPath = path.join(OUTPUT_DIR, "latest.png");

    await page.screenshot({ path: filepath, fullPage: true });
    fs.copyFileSync(filepath, latestPath);

    console.log(`Screenshot saved: ${filepath}`);
    console.log(`Latest alias: ${latestPath}`);
  } finally {
    await browser.close();
  }
}

screenshot().catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});
